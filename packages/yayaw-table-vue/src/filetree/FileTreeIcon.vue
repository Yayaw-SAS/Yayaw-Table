<script setup lang="ts">
import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileMusic,
  FilePlay,
  FileText,
  Folder,
  FolderOpen,
} from "lucide-vue-next";
import type { Component } from "vue";
import type { FileTreeIcon, FileTreeIconKind } from "../filetree-model";

/** A folder or file icon, or the host's image from `getIcon`. */
const props = defineProps<{ icon: FileTreeIcon }>();
const ICONS: Record<FileTreeIconKind, Component> = {
  folder: Folder,
  "folder-open": FolderOpen,
  image: FileImage,
  video: FilePlay,
  audio: FileMusic,
  document: FileText,
  archive: FileArchive,
  code: FileCode,
  file: File,
};
</script>

<template>
  <span class="yayaw-ft-icon" :data-kind="props.icon.kind" aria-hidden="true">
    <img v-if="props.icon.src" :src="props.icon.src" :alt="props.icon.alt ?? ''" width="18" height="18" />
    <component :is="ICONS[props.icon.kind] ?? File" v-else />
  </span>
</template>
