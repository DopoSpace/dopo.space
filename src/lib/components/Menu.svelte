<script lang="ts">
	import MenuItem from './MenuItem.svelte';
</script>

<div class="absolute top-0 left-0 bg-dopoRed px-4 py-2 w-full">
	<div class="flex justify-start items-center gap-4">
		<MenuItem to="/" item="Home" />
		<MenuItem to="/about" item="About" />
		<MenuItem to="/contact" item="Contact" />
	</div>
</div>
