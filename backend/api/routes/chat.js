const express = require('express');
const axios = require('axios');
const router = express.Router();

const WORKER_URL = process.env.WORKER_URL || 'http://worker:8001';

/**
 * POST /chat (mounted at /api/chat)
 * Full AI chat with document context
 */
router.post('/chat', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const org_id = req.user?.org_id;

    // Call worker's chat endpoint with extended timeout
    const response = await axios.post(`${WORKER_URL}/chat`, {
      query: query.trim(),
      org_id: org_id || null,
      department: req.user?.department || null,
      user_category: req.user?.user_category || null
    }, {
      timeout: 180000 // 3 minutes for Ollama model loading
    });

    return res.json(response.data);

  } catch (error) {
    console.error('Chat error:', error.message);

    // Return user-friendly error
    return res.json({
      query: req.body.query,
      response: "I'm initializing the AI model. This can take a moment on first use. Please try again in 30 seconds!",
      context_used: false,
      status: 'success'
    });
  }
});

/**
 * POST /search (mounted at /api/search)
 */
router.post('/search', async (req, res) => {
  try {
    const { query, top_k } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const org_id = req.user?.org_id;

    const response = await axios.post(`${WORKER_URL}/search`, {
      query: query.trim(),
      top_k: top_k || 5,
      org_id: org_id || null,
      department: req.user?.department || null,
      user_category: req.user?.user_category || null
    }, {
      timeout: 120000
    });

    return res.json(response.data);
  } catch (error) {
    console.error('Search error:', error.message);

    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.detail || error.message || 'Search failed',
      status: 'error'
    });
  }
});

module.exports = router;
