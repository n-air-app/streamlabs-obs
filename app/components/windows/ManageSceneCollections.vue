<template>
<modal-layout
  :show-cancel="false"
  :done-handler="close">
  <div slot="content">
    <div class="manage-scene-collections__header">
      <div class="input-wrapper input-wrapper--search">
        <input class="input--search" type="text" :placeholder="$t('common.search')" v-model="searchQuery" />
      </div>

      <button class="button button--action" @click="create">
        <i class="icon-plus" />
        {{ $t('common.createNew') }}
      </button>
    </div>
    <editable-scene-collection
      v-for="collection in collections"
      :key="collection.id"
      :collection-id="collection.id"/>
  </div>
</modal-layout>
</template>

<script lang="ts" src="./ManageSceneCollections.vue.ts"></script>

<style lang="less" scoped>
@import "../../styles/index";

.manage-scene-collections__header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-wrapper--search {
  width: 50%;
}

.manage-scene-collections--new {
  &:hover {
    background: @hover;
  }
}

</style>
