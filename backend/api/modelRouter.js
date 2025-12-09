const axios = require('axios');

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PRIMARY_MODEL = process.env.PRIMARY_MODEL || 'gpt-4o-mini';
const LOCAL_CHAT_MODEL = process.env.LOCAL_CHAT_MODEL || 'phi3:mini';

let isOpenAIReachable = false;
let lastCheckTime = 0;
const CHECK_INTERVAL = 60 * 1000; // Check every minute

async function checkOpenAIAvailability() {
    if (!OPENAI_API_KEY) {
        isOpenAIReachable = false;
        return false;
    }

    // Don't check too often
    if (Date.now() - lastCheckTime < CHECK_INTERVAL) {
        return isOpenAIReachable;
    }

    try {
        await axios.get('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            timeout: 5000
        });
        isOpenAIReachable = true;
    } catch (error) {
        console.warn('OpenAI unreachable:', error.message);
        isOpenAIReachable = false;
    } finally {
        lastCheckTime = Date.now();
    }

    return isOpenAIReachable;
}

// Initial check
checkOpenAIAvailability();

function getModelStatus() {
    return {
        openai_available: isOpenAIReachable,
        primary_model: PRIMARY_MODEL,
        local_model: LOCAL_CHAT_MODEL,
        active_model: isOpenAIReachable ? PRIMARY_MODEL : LOCAL_CHAT_MODEL,
        using_fallback: !isOpenAIReachable
    };
}

module.exports = {
    checkOpenAIAvailability,
    getModelStatus
};
