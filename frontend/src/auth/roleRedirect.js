export const redirectBasedOnRole = (role) => {
    switch (role) {
        case 'super_admin':
            return '/super-admin';
        case 'admin':
            return '/admin';
        case 'data_steward':
            return '/data';
        case 'auditor':
            return '/audit';
        case 'user':
        default:
            return '/dashboard';
    }
};
