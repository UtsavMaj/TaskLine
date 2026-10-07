// Extends app.json. Android push notifications go through Firebase Cloud Messaging, which needs
// google-services.json from your Firebase project. It's optional: without it the app still builds
// and "due tomorrow" reminders fall back to notifications scheduled on the phone.
// The path can also come from an EAS "file" environment variable named GOOGLE_SERVICES_JSON.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
  const hasFirebase = fs.existsSync(path.resolve(__dirname, googleServicesFile));

  return {
    ...config,
    android: {
      ...config.android,
      ...(hasFirebase ? { googleServicesFile } : {}),
    },
  };
};
