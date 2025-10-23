// Quick deployment verification for rider system
console.log('🚀 Testing Rider System Deployment...\n');

const testEndpoints = async () => {
  const tests = [
    {
      name: 'Backend Health Check',
      url: 'https://home-services-5alb.onrender.com/api/health',
      method: 'GET'
    },
    {
      name: 'Rider Routes Test',
      url: 'https://home-services-5alb.onrender.com/api/riders/test',
      method: 'GET'
    },
    {
      name: 'Rider Login Demo',
      url: 'https://home-services-5alb.onrender.com/api/riders/login',
      method: 'POST',
      body: { phone: '9876543210', password: 'password123' }
    }
  ];

  for (const test of tests) {
    try {
      console.log(`🔍 ${test.name}...`);
      
      const options = {
        method: test.method,
        headers: { 'Content-Type': 'application/json' }
      };
      
      if (test.body) {
        options.body = JSON.stringify(test.body);
      }
      
      const response = await fetch(test.url, options);
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${test.name}: SUCCESS`);
        
        if (test.name === 'Rider Login Demo' && result.rider) {
          console.log(`   - Rider: ${result.rider.name} (${result.rider.status})`);
          console.log(`   - Token generated: ${!!result.token}`);
          if (result.message) console.log(`   - Message: ${result.message}`);
        }
      } else {
        console.log(`❌ ${test.name}: FAILED (${response.status} ${response.statusText})`);
        
        if (response.status === 404) {
          console.log('   💡 Rider routes may not be deployed to production yet');
        }
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
    }
    
    console.log(''); // Empty line for spacing
  }
  
  console.log('📋 SUMMARY:');
  console.log('If all tests pass, the rider system is fully deployed!');
  console.log('Access rider portal at: https://www.laundrify.online/rider');
  console.log('Demo credentials: Phone: 9876543210, Password: password123');
  console.log('');
  console.log('If rider routes fail, run: npm run deploy or check Render logs');
};

// Export for use in browser console
if (typeof module !== 'undefined' && module.exports) {
  module.exports = testEndpoints;
}

// Auto-run if available
if (typeof fetch !== 'undefined') {
  testEndpoints();
} else {
  console.log('⚠️ This script requires fetch API. Run in browser console or Node.js with fetch polyfill.');
}
