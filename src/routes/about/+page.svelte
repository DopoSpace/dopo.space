<script lang="ts">
	import TextContainer from '$lib/components/TextContainer.svelte';
	import PublicPageLayout from '$lib/components/PublicPageLayout.svelte';
	import * as m from '$lib/paraglide/messages';
</script>

<PublicPageLayout>
	<TextContainer>
	<p>
		{m.about_paragraph1()}
	</p>
	<p>
		{m.about_paragraph2()}
	</p>
	<p>
		{m.about_paragraph3()}
	</p>
	<p class="pt-8">
		<a href="/dopo_space_trasparenza_dati.pdf" target="_blank">
			{m.about_transparency()}
		</a>
	</p>
	</TextContainer>
</PublicPageLayout>
