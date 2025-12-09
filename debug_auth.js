// Debug auth dependencies
try {
    console.log("Loading authMiddleware...");
    const authMiddleware = require('./backend/api/middleware/authMiddleware');
    console.log("authMiddleware exports:", Object.keys(authMiddleware));
    console.log("authenticateJWT type:", typeof authMiddleware.authenticateJWT);

    if (typeof authMiddleware.authenticateJWT !== 'function') {
        console.error("❌ authenticateJWT is NOT a function!");
    } else {
        console.log("✅ authenticateJWT is a function");
    }

    console.log("\nLoading auth routes...");
    const authRoutes = require('./backend/api/routes/auth');
    console.log("✅ Auth routes loaded");

} catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
}
