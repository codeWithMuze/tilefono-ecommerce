require('dotenv').config()


const razorpayConfig = {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_Igq5n4zuOwcSH6',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'FCcbnbXsC8DXrkF4XSKwByx2'
};


console.log('Razorpay Configuration:');
console.log('- Key ID: ', razorpayConfig.keyId ? (razorpayConfig.keyId.substring(0, 8) + '...') : 'Not set');
console.log('- Secret: ', razorpayConfig.keySecret ? 'Is set (hidden)' : 'Not set');


if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn('⚠️ WARNING: Razorpay credentials not found in environment variables.');
    console.warn('Using demo test keys for development purposes - these will only work in test mode.');
    console.warn('For production, set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file.');
} else {
    console.log('✅ Razorpay configuration loaded successfully.');
}

module.exports = razorpayConfig; 