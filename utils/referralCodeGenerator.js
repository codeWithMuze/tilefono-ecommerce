function generateReferralCode(name) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); // Random 4-digit number
    const sanitizedName = name.toUpperCase().replace(/\s+/g, '').substring(0, 4); // First 4 characters of the name
    return `${sanitizedName}${randomSuffix}`;
}

module.exports = generateReferralCode;