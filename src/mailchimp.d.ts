/**
 * Type declarations for @mailchimp/mailchimp_marketing
 * The official package doesn't include TypeScript definitions
 */

declare module '@mailchimp/mailchimp_marketing' {
	interface Config {
		apiKey: string;
		server: string;
	}

	interface MergeFields {
		FNAME?: string;
		LNAME?: string;
		[key: string]: string | undefined;
	}

	interface ListMember {
		email_address: string;
		status: 'subscribed' | 'unsubscribed' | 'cleaned' | 'pending';
		merge_fields?: MergeFields;
	}

	interface MemberResponse {
		id: string;
		email_address: string;
		status: string;
		[key: string]: unknown;
	}

	interface Lists {
		addListMember(listId: string, body: ListMember): Promise<MemberResponse>;
		updateListMember(
			listId: string,
			subscriberHash: string,
			body: Partial<ListMember>
		): Promise<MemberResponse>;
	}

	interface MailchimpMarketing {
		setConfig(config: Config): void;
		lists: Lists;
	}

	const mailchimp: MailchimpMarketing;
	export default mailchimp;
}
