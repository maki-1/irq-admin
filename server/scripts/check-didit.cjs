// Read-only connection check. No sessions or resident data are created/read.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

(async () => {
  const key = process.env.DIDIT_API_KEY?.trim();
  const workflowId = process.env.DIDIT_WORKFLOW_ID?.trim();
  if (!key || !workflowId) throw new Error('Set DIDIT_API_KEY and DIDIT_WORKFLOW_ID on the server.');
  const { data } = await axios.get(`https://verification.didit.me/v3/workflows/${encodeURIComponent(workflowId)}/`, {
    headers: { 'x-api-key': key }, timeout: 20000, maxRedirects: 0,
  });
  const summary = {
    connected: true, workflow: data.workflow_label, status: data.status,
    livenessEnabled: data.is_liveness_enabled, method: data.face_liveness_method,
    faceMatchEnabled: data.is_face_match_enabled,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (data.status !== 'published' || !data.is_liveness_enabled || !data.is_face_match_enabled) {
    throw new Error('Publish a workflow with ID Verification, Liveness, and Face Match enabled.');
  }
})().catch((err) => {
  // Do not print Axios errors/config: they contain the API key.
  console.error(err.response ? `Didit connection failed (HTTP ${err.response.status}). Check the server key and workflow.` : err.isAxiosError ? 'Could not connect to Didit.' : err.message);
  process.exitCode = 1;
});
