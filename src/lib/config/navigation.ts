export interface NavItem {
	to: string;
	/** Message key for i18n - used to look up the translated label */
	labelKey: 'home' | 'about' | 'contact' | 'membership';
}

export const navigationItems: NavItem[] = [
	{ to: '/', labelKey: 'home' },
	{ to: '/about', labelKey: 'about' },
	{ to: '/contact', labelKey: 'contact' },
	{ to: '/auth/login', labelKey: 'membership' }
];
