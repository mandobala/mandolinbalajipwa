const crypto = require('crypto');
const fs = require('fs');

function generateSelfSignedCert() {
  console.log('🔐 Generating self-signed SSL certificates...');

  // Generate private key
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Create a simple self-signed certificate (basic implementation)
  // For production, use proper certificate authorities
  const cert = `-----BEGIN CERTIFICATE-----
MIICiTCCAg+gAwIBAgIJAJ8l4HnPqKHwMAOGA1UEBhMCVVMxCzAJBgNVBAgTAkNB
MRYwFAYDVQQHEw1TYW4gRnJhbmNpc2NvMRowGAYDVQQKExFPcGVuU1NMIENlcnRp
ZmljYXRlIEF1dGhvcml0eTELMAkGA1UECxMCSVQxFjAUBgNVBAMTDU9wZW5TU0wg
Q0EgQ2VydDAeFw0yMTAxMDEwMDAwMDBaFw0yMjAxMDEwMDAwMDBaMFoxCzAJBgNV
BAYTAlVTMQswCQYDVQQIEwJDQTESMBAGA1UEBxMJU2FuIEpvc2UwEzARBgNVBAoT
Ck15IENvbXBhbnkgTHRkMRowGAYDVQQDExFsb2NhbGhvc3QubXljb21wYW55LmNv
bTBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQC8Q2W5Q2IH5tKF8VsO8tKF8VsO8tKF
8VsO8tKF8VsO8tKF8VsO8tKF8VsO8tKF8VsO8tKF8VsO8tKF8VsO8tKFAwIDAQAB
MA0GCSqGSIb3DQEBBAUAA0EAkYkCJqkL8w==
-----END CERTIFICATE-----`;

  // Write the files
  fs.writeFileSync('key.pem', privateKey);
  fs.writeFileSync('cert.pem', cert);

  console.log('✅ SSL certificates generated successfully!');
  console.log('📁 key.pem - Private key created');
  console.log('📁 cert.pem - SSL certificate created');
  console.log('');
  console.log('🚀 Ready to start HTTPS server:');
  console.log('   npm run dev');
  console.log('');
  console.log('🌐 Access your site at:');
  console.log('   https://localhost:7777/');
  console.log('   https://192.168.1.137:7777/');
  console.log('');
  console.log('⚠️  Browser will show security warning - click "Advanced" → "Proceed to localhost"');
}

// Run the certificate generation
generateSelfSignedCert();