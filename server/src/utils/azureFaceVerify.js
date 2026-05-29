const axios = require('axios');

const BASE = `${process.env.AZURE_FACE_ENDPOINT}/face/v1.0`;
const HEADERS = {
  'Ocp-Apim-Subscription-Key': process.env.AZURE_FACE_KEY,
  'Content-Type': 'application/json',
};

async function detectFace(imageUrl) {
  const { data } = await axios.post(
    `${BASE}/detect`,
    { url: imageUrl },
    {
      params: {
        returnFaceId: true,
        recognitionModel: 'recognition_04',
        detectionModel: 'detection_03',
      },
      headers: HEADERS,
    }
  );
  return data; // array of { faceId, ... }
}

async function azureVerifyIdentity(facePhotoUrl, idFrontUrl) {
  const [selfieFaces, idFaces] = await Promise.all([
    detectFace(facePhotoUrl),
    detectFace(idFrontUrl),
  ]);

  if (!selfieFaces.length) {
    return { isIdentical: false, confidence: 0, error: 'No face detected in selfie photo' };
  }
  if (!idFaces.length) {
    return { isIdentical: false, confidence: 0, error: 'No face detected in ID photo' };
  }

  const { data } = await axios.post(
    `${BASE}/verify`,
    { faceId1: selfieFaces[0].faceId, faceId2: idFaces[0].faceId },
    { headers: HEADERS }
  );

  return { isIdentical: data.isIdentical, confidence: data.confidence, error: null };
}

module.exports = { azureVerifyIdentity };
