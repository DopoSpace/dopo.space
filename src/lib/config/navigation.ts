export interface NavItem {
	to: string;
	label: string;
}

export const navigationItems: NavItem[] = [
	{ to: '/', label: 'Home' },
	{ to: '/about', label: 'About' },
	{ to: '/contact', label: 'Contact' },
	{ to: '/auth/login', label: 'Membership' }
];
