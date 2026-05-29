const cloudinary       = require('../config/cloudinary');
const ResidentUser     = require('../models/ResidentUser');
const VerificationProfile = require('../models/VerificationProfile');
const { verifyIdentity }      = require('../utils/groqVerify');
const { azureVerifyIdentity } = require('../utils/azureFaceVerify');

async function uploadBuffer(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(buffer);
  });
}

/* ── POST /api/verification/step1 ───────────────────────── */
exports.step1 = async (req, res) => {
  try {
    const userId = req.resident._id;
    const {
      firstName, middleName, lastName,
      birthday, gender, civilStatus, yearsAtAddress,
      houseNo, street, barangay, city,
      motherName, fatherName,
      isPwd, isSenior, isIndigent, age,
    } = req.body;

    if (!firstName || !lastName || !birthday || !gender || !street || !barangay || !city) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
    const address  = [houseNo, street, barangay, city].filter(Boolean).join(', ');

    // Upload optional proof files
    let pwdProofUrl = null;
    let indigentProofUrl = null;

    if (req.files?.pwdProof?.[0]) {
      pwdProofUrl = await uploadBuffer(req.files.pwdProof[0].buffer, 'irequestd/proofs');
    }
    if (req.files?.indigentProof?.[0]) {
      indigentProofUrl = await uploadBuffer(req.files.indigentProof[0].buffer, 'irequestd/proofs');
    }

    const profileData = {
      user: userId,
      fullName,
      birthday,
      age: Number(age) || null,
      gender,
      civilStatus,
      yearsAtAddress: Number(yearsAtAddress) || 0,
      address,
      motherName, fatherName,
      isPwd: isPwd === 'true' || isPwd === true,
      isSenior: isSenior === 'true' || isSenior === true,
      isIndigent: isIndigent === 'true' || isIndigent === true,
      ...(pwdProofUrl && { pwdProof: pwdProofUrl }),
      ...(indigentProofUrl && { indigentProof: indigentProofUrl }),
      status: 'submitted',
    };

    // Upsert verification profile
    await VerificationProfile.findOneAndUpdate(
      { user: userId },
      profileData,
      { upsert: true, new: true }
    );

    // Update resident user's step and special categories
    await ResidentUser.findByIdAndUpdate(userId, {
      verificationStep: 1,
      isPwd: profileData.isPwd,
      isSenior: profileData.isSenior,
      isIndigent: profileData.isIndigent,
    });

    res.json({ message: 'Step 1 saved', step: 1 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/verification/step2 ───────────────────────── */
exports.step2 = async (req, res) => {
  try {
    const userId = req.resident._id;
    const { educationLevel, schoolName, graduationYear, course } = req.body;

    if (!educationLevel || !schoolName || !graduationYear) {
      return res.status(400).json({ message: 'Education level, school name, and graduation year are required' });
    }

    let educationCertUrl = null;
    if (req.files?.educationCert?.[0]) {
      educationCertUrl = await uploadBuffer(req.files.educationCert[0].buffer, 'irequestd/education');
    }

    await VerificationProfile.findOneAndUpdate(
      { user: userId },
      {
        educationLevel,
        school: schoolName,
        yearGraduated: Number(graduationYear),
        course: course || '',
        ...(educationCertUrl && { educationCertificate: educationCertUrl }),
      },
      { upsert: true, new: true }
    );

    await ResidentUser.findByIdAndUpdate(userId, { verificationStep: 2 });

    res.json({ message: 'Step 2 saved', step: 2 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/verification/step3 ───────────────────────── */
exports.step3 = async (req, res) => {
  try {
    const userId = req.resident._id;
    const {
      idType, idName,
      secondaryIdType, secondaryIdName,
      secondaryId2Type, secondaryId2Name,
    } = req.body;

    if (!idType || !req.files?.idFront?.[0]) {
      return res.status(400).json({ message: 'Primary ID type and front photo are required' });
    }
    if (!req.files?.facePhoto?.[0]) {
      return res.status(400).json({ message: 'Face photo is required' });
    }

    const [idFrontUrl, facePhotoUrl] = await Promise.all([
      uploadBuffer(req.files.idFront[0].buffer, 'irequestd/ids'),
      uploadBuffer(req.files.facePhoto[0].buffer, 'irequestd/faces'),
    ]);

    let idBackUrl = null;
    if (req.files?.idBack?.[0]) {
      idBackUrl = await uploadBuffer(req.files.idBack[0].buffer, 'irequestd/ids');
    }

    let secondaryIdFrontUrl = null;
    let secondaryId2FrontUrl = null;
    if (req.files?.secondaryIdFront?.[0]) {
      secondaryIdFrontUrl = await uploadBuffer(req.files.secondaryIdFront[0].buffer, 'irequestd/ids');
    }
    if (req.files?.secondaryId2Front?.[0]) {
      secondaryId2FrontUrl = await uploadBuffer(req.files.secondaryId2Front[0].buffer, 'irequestd/ids');
    }

    // Run Groq (doc validity) + Azure Face (face match) in parallel — non-blocking
    let aiVerification = null;
    try {
      const [groqResult, azureResult] = await Promise.allSettled([
        verifyIdentity(facePhotoUrl, idFrontUrl),
        azureVerifyIdentity(facePhotoUrl, idFrontUrl),
      ]);

      aiVerification = { checkedAt: new Date() };

      if (groqResult.status === 'fulfilled') {
        Object.assign(aiVerification, groqResult.value);
      } else {
        console.error('Groq verification error:', groqResult.reason?.message);
      }

      if (azureResult.status === 'fulfilled') {
        aiVerification.azureIsIdentical = azureResult.value.isIdentical;
        aiVerification.azureConfidence  = azureResult.value.confidence;
        aiVerification.azureError       = azureResult.value.error || null;
      } else {
        console.error('Azure Face error:', azureResult.reason?.message);
        aiVerification.azureError = azureResult.reason?.message || 'Azure check failed';
      }
    } catch (aiErr) {
      console.error('Verification error:', aiErr.message);
    }

    const updateData = {
      idType,
      idName: idName || idType,
      idFront: idFrontUrl,
      facePhoto: facePhotoUrl,
      status: 'Pending',
      ...(aiVerification && { aiVerification }),
      ...(idBackUrl && { idBack: idBackUrl }),
      ...(secondaryIdType && { secondaryIdType }),
      ...(secondaryIdName && { secondaryIdName }),
      ...(secondaryIdFrontUrl && { secondaryIdFront: secondaryIdFrontUrl }),
      ...(secondaryId2Type && { secondaryId2Type }),
      ...(secondaryId2Name && { secondaryId2Name }),
      ...(secondaryId2FrontUrl && { secondaryId2Front: secondaryId2FrontUrl }),
    };

    await VerificationProfile.findOneAndUpdate(
      { user: userId },
      updateData,
      { upsert: true, new: true }
    );

    await ResidentUser.findByIdAndUpdate(userId, {
      verificationStep: 3,
      verificationStatus: 'pending',
    });

    res.json({ message: 'Verification submitted for review', step: 3 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── GET /api/verification/status ───────────────────────── */
exports.getStatus = async (req, res) => {
  try {
    const userId = req.resident._id;
    const user   = await ResidentUser.findById(userId).lean();

    // Also check the VerificationProfile status in case admin updated it
    const profile = await VerificationProfile.findOne({ user: userId })
      .select('status remarks fullName')
      .lean();

    let verificationStatus = user.verificationStatus || profile?.status || null;
    let isVerified = user.isVerified || false;

    // Sync: if profile is approved, mark user as verified
    if (
      profile?.status &&
      ['approved', 'Approved'].includes(profile.status) &&
      !isVerified
    ) {
      await ResidentUser.findByIdAndUpdate(userId, {
        isVerified: true,
        verificationStatus: 'approved',
      });
      isVerified = true;
      verificationStatus = 'approved';
    }

    // Sync: if profile was reset (rejected), update user status
    if (!profile && user.verificationStep === 3) {
      await ResidentUser.findByIdAndUpdate(userId, {
        verificationStatus: 'rejected',
        verificationStep: 0,
      });
      verificationStatus = 'rejected';
    }

    res.json({
      status: verificationStatus,
      isVerified,
      verificationStep: user.verificationStep || 0,
      rejectionReason: profile?.remarks || user.rejectionReason || null,
      fullName: profile?.fullName || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
