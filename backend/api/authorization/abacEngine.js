/**
 * ABAC (Attribute-Based Access Control) Policy Engine
 * Evaluates access control based on subject, resource, action, and contextual attributes
 * 
 * Features:
 * - Loads policies from abac_policies.json
 * - Supports multiple condition types (owner_match, same_department, teaches_course, etc.)
 * - Effect: allow/deny with explicit deny override
 * - Policy caching for performance
 * - Detailed access decision logging
 */

const fs = require('fs');
const path = require('path');

class ABACEngine {
    constructor(policiesPath) {
        this.policiesPath = policiesPath || path.join(__dirname, '../../../Datasets/University/final/abac_policies.json');
        this.policies = [];
        this.cache = new Map();
        this.loadPolicies();
    }

    /**
     * Load ABAC policies from JSON file
     */
    loadPolicies() {
        try {
            const data = fs.readFileSync(this.policiesPath, 'utf8');
            const policyData = JSON.parse(data);
            this.policies = policyData.policies || [];
            console.log(`[ABAC] Loaded ${this.policies.length} policies from ${this.policiesPath}`);
        } catch (error) {
            console.error('[ABAC] Error loading policies:', error);
            this.policies = [];
        }
    }

    /**
     * Reload policies from file (for hot-reload)
     */
    reloadPolicies() {
        this.cache.clear();
        this.loadPolicies();
    }

    /**
     * Main evaluation function
     * @param {Object} subject - User making the request (with role, department, etc.)
     * @param {Object} resource - Resource being accessed
     * @param {String} action - Action being performed (read, create, update, delete)
     * @param {Object} context - Additional context (time, IP, etc.)
     * @returns {Object} { allowed: boolean, matchedPolicies: [], reason: string }
     */
    async evaluate(subject, resource, action, context = {}) {
        // Cache key for performance
        const cacheKey = this.getCacheKey(subject, resource, action);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const result = {
            allowed: false,
            matchedPolicies: [],
            denyPolicies: [],
            reason: 'No matching policy found'
        };

        // Find all matching policies
        for (const policy of this.policies) {
            if (this.policyMatches(policy, subject, resource, action, context)) {
                result.matchedPolicies.push(policy.policy_id);

                if (policy.effect === 'deny') {
                    result.denyPolicies.push(policy.policy_id);
                }
            }
        }

        // Explicit deny overrides allow (security first)
        if (result.denyPolicies.length > 0) {
            result.allowed = false;
            result.reason = `Access denied by policy: ${result.denyPolicies.join(', ')}`;
        } else if (result.matchedPolicies.length > 0) {
            result.allowed = true;
            result.reason = `Access granted by policy: ${result.matchedPolicies.join(', ')}`;
        }

        // Cache result (TTL: 5 minutes)
        this.cache.set(cacheKey, result);
        setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

        return result;
    }

    /**
     * Check if policy matches the request
     */
    policyMatches(policy, subject, resource, action, context) {
        // 1. Check subject (role, attributes)
        if (!this.subjectMatches(policy.subject, subject)) {
            return false;
        }

        // 2. Check resource type
        if (!this.resourceMatches(policy.resource, resource)) {
            return false;
        }

        // 3. Check action
        if (!this.actionMatches(policy.action, action)) {
            return false;
        }

        // 4. Check conditions
        if (!this.conditionsMatch(policy.conditions, subject, resource, context)) {
            return false;
        }

        return true;
    }

    /**
     * Check if subject matches policy subject requirements
     */
    subjectMatches(policySubject, actualSubject) {
        if (!policySubject) return true; // No subject restriction

        // Check role
        if (policySubject.role && policySubject.role !== actualSubject.role) {
            return false;
        }

        // Check additional subject attributes
        for (const [key, value] of Object.entries(policySubject)) {
            if (key !== 'role' && actualSubject[key] !== value) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if resource matches policy resource requirements
     */
    resourceMatches(policyResource, actualResource) {
        if (!policyResource) return true; // No resource restriction

        const resourceType = policyResource.type;

        // Wildcard match
        if (resourceType === '*') return true;

        // Array of resource types
        if (Array.isArray(resourceType)) {
            return resourceType.includes(actualResource.type);
        }

        // Single resource type
        return resourceType === actualResource.type;
    }

    /**
     * Check if action matches policy action requirements
     */
    actionMatches(policyActions, actualAction) {
        if (!policyActions) return true; // No action restriction

        if (Array.isArray(policyActions)) {
            return policyActions.includes(actualAction);
        }

        return policyActions === actualAction;
    }

    /**
     * Evaluate policy conditions
     */
    conditionsMatch(conditions, subject, resource, context) {
        if (!conditions || Object.keys(conditions).length === 0) {
            return true; // No conditions to check
        }

        for (const [conditionType, expectedValue] of Object.entries(conditions)) {
            const conditionMet = this.evaluateCondition(conditionType, expectedValue, subject, resource, context);
            if (!conditionMet) {
                return false;
            }
        }

        return true;
    }

    /**
     * Evaluate individual condition
     */
    evaluateCondition(conditionType, expectedValue, subject, resource, context) {
        switch (conditionType) {
            case 'owner_match':
                // User owns the resource
                return this.checkOwnerMatch(subject, resource, expectedValue);

            case 'same_department':
                // User and resource in same department
                return this.checkSameDepartment(subject, resource, expectedValue);

            case 'same_organization':
                // User and resource in same organization
                return this.checkSameOrganization(subject, resource, expectedValue);

            case 'teaches_course':
                // Faculty teaches this course
                return this.checkTeachesCourse(subject, resource, expectedValue);

            case 'anonymized':
                // Resource is anonymized
                return resource.anonymized === expectedValue;

            case 'is_department_head':
                // User is department head
                return subject.is_department_head === expectedValue;

            case 'willing_to_mentor':
                // Alumni willing to mentor
                return resource.willing_to_mentor === expectedValue;

            default:
                console.warn(`[ABAC] Unknown condition type: ${conditionType}`);
                return false;
        }
    }

    /**
     * Check owner match condition
     */
    checkOwnerMatch(subject, resource, expectedValue) {
        const isOwner =
            resource.user_id === subject.userId ||
            resource.student_id === subject.entityId ||
            resource.owner_id === subject.userId;

        return isOwner === expectedValue;
    }

    /**
     * Check same department condition
     */
    checkSameDepartment(subject, resource, expectedValue) {
        const sameDept = subject.department === resource.department ||
            subject.department === resource.department_id;

        return sameDept === expectedValue;
    }

    /**
     * Check same organization condition
     */
    checkSameOrganization(subject, resource, expectedValue) {
        const sameOrg = subject.organizationId === resource.organization_id;
        return sameOrg === expectedValue;
    }

    /**
     * Check teaches course condition
     */
    checkTeachesCourse(subject, resource, expectedValue) {
        // Check if faculty teaches this course
        // This would need integration with faculty-course mapping
        const teaches = subject.courses && subject.courses.includes(resource.course_id);
        return teaches === expectedValue;
    }

    /**
     * Generate cache key
     */
    getCacheKey(subject, resource, action) {
        return `${subject.userId}:${resource.type}:${resource.id || 'all'}:${action}`;
    }

    /**
     * Get policy statistics
     */
    getStats() {
        const stats = {
            totalPolicies: this.policies.length,
            cacheSize: this.cache.size,
            policiesByEffect: {
                allow: 0,
                deny: 0
            },
            policiesByRole: {}
        };

        this.policies.forEach(policy => {
            stats.policiesByEffect[policy.effect]++;
            const role = policy.subject?.role || 'all';
            stats.policiesByRole[role] = (stats.policiesByRole[role] || 0) + 1;
        });

        return stats;
    }
}

// Singleton instance
let engineInstance = null;

function getABACEngine(policiesPath) {
    if (!engineInstance) {
        engineInstance = new ABACEngine(policiesPath);
    }
    return engineInstance;
}

module.exports = {
    ABACEngine,
    getABACEngine
};
