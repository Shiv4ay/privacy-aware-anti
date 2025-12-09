// Test if Phase 4 routes file can be loaded
try {
    console.log("Testing Phase 4 routes import...");
    const authRoutes = require('./backend/api/routes/auth.js');
    console.log("✅ Routes loaded successfully");
    console.log("Type:", typeof authRoutes);
    console.log("Is Router?:", authRoutes.constructor.name);
} catch (error) {
    console.error("❌ Failed to load routes:", error.message);
    console.error(error.stack);
}
