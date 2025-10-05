#!/usr/bin/env node

/**
 * Test script to verify rider login works with demo credentials
 */

const testRiderLogin = async () => {
  const credentials = [
    { phone: '9876543210', password: 'password123' },
    { phone: '9876543211', password: 'demo123' },
    { phone: '9999999999', password: 'test123' }
  ];

  console.log('🧪 Testing Rider Login with Demo Credentials\n');

  for (const cred of credentials) {
    try {
      console.log(`📱 Testing: Phone=${cred.phone}, Password=${cred.password}`);
      
      // Test local development
      const localResponse = await fetch('http://localhost:3001/api/riders/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cred)
      });

      if (localResponse.ok) {
        const result = await localResponse.json();
        console.log(`✅ Local Success: ${result.rider.name} (${result.rider.status})`);
        if (result.message) console.log(`   Message: ${result.message}`);
      } else {
        console.log(`❌ Local Failed: ${localResponse.status} ${localResponse.statusText}`);
      }

      // Test production backend (if accessible)
      try {
        const prodResponse = await fetch('https://home-services-5alb.onrender.com/api/riders/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cred)
        });

        if (prodResponse.ok) {
          const result = await prodResponse.json();
          console.log(`✅ Production Success: ${result.rider.name}`);
        } else {
          console.log(`❌ Production Failed: ${prodResponse.status} ${prodResponse.statusText}`);
        }
      } catch (e) {
        console.log(`❌ Production Unreachable: ${e.message}`);
      }

      console.log(''); // Empty line for spacing
    } catch (error) {
      console.log(`❌ Error testing ${cred.phone}: ${error.message}\n`);
    }
  }

  // Test rider routes availability
  console.log('🔍 Testing Rider Routes Availability:\n');
  
  try {
    const testResponse = await fetch('http://localhost:3001/api/riders/test');
    if (testResponse.ok) {
      const result = await testResponse.json();
      console.log('✅ Local Rider Routes Available');
      console.log(`   Features: ${JSON.stringify(result.features, null, 2)}`);
      if (result.demoCredentials) {
        console.log(`   Demo Credentials: ${JSON.stringify(result.demoCredentials, null, 2)}`);
      }
    }
  } catch (e) {
    console.log(`❌ Local rider routes not accessible: ${e.message}`);
  }

  console.log('\n📋 SUMMARY:');
  console.log('• Local Development: http://localhost:10000/rider');
  console.log('• Production Frontend: https://www.laundrify.online/rider');
  console.log('• Use any phone number + any password in demo mode');
  console.log('• Recommended test credentials: 9876543210 / password123');
};

// Run if called directly
if (require.main === module) {
  testRiderLogin().catch(console.error);
}

module.exports = testRiderLogin;
