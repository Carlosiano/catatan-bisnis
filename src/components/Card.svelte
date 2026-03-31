<script>
  export let title = '';
</script>

<div class="card">
  <h4>{title}</h4>
  <slot />
</div>

<style>
.card {
  background: white;
  padding: 16px;
  border-radius: 10px;
  margin-bottom: 16px;
}
</style>