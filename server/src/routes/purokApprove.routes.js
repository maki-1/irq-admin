const router = require('express').Router();
const { getPending, act } = require('../controllers/purokApprove.controller');

// Public on purpose — authorisation is the signed link, not a session. Every
// handler re-verifies the token and scopes to the leader's own purok.
router.get('/pending', getPending);
router.post('/action', act);

module.exports = router;
