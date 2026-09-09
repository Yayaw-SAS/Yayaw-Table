<script setup lang="ts">
import { computed, ref } from "vue";
import { PanelRight, Square, LayoutTemplate, RotateCcw } from "lucide-vue-next";
import { DataTable, defineTableConfig } from "../src";
import type { TableActions, TableRecord } from "../src/types";
import type { DetailPresentation } from "../src/record-details";
import { detailExampleRow, recordDetailsConfig, recordExampleColumns, recordSections, updateExampleRecord, revertExampleRecord } from "../../../examples/record-details";
import type { DetailRevertHandler } from "../src/record-details";

const rows = ref<TableRecord[]>([structuredClone(detailExampleRow)]);
const presentation = ref<DetailPresentation>("drawer");
const detailConfig = computed(() => ({ ...recordDetailsConfig, presentation: presentation.value }));
const feedback = ref("");
const config = defineTableConfig({
  id: "record-details-demo", columns: { definitions: recordExampleColumns, visible: recordExampleColumns.map(column => column.id), order: recordExampleColumns.map(column => column.id), mandatory: [] },
  table: { syncUrl: false, rowClickMode: "activate", enableRowClickEdit: false, allowCreate: false, allowDuplicate: false, enableRowSelection: false, enableViews: false, showToolbarHeader: false, allowEdit: true, allowDelete: true },
  translations: { namespace: "record-details-demo", keys: {} },
});
const actions: TableActions = {
  update: (id, patch) => { rows.value = rows.value.map(row => row.id === id ? updateExampleRecord(row, patch) : row); feedback.value = "Modification enregistrée. Retrouvez-la dans l’activité de la fiche."; return { success: true }; },
  delete: id => { rows.value = rows.value.filter(row => row.id !== id); feedback.value = "L’entrée de démonstration a été supprimée. Vous pouvez réinitialiser l’exemple."; return { success: true }; },
};
const reset = () => { rows.value = [structuredClone(detailExampleRow)]; feedback.value = "Exemple réinitialisé."; };
const revertActivity: DetailRevertHandler = (row, entry) => {
  const current = rows.value.find(item => item.id === row.id);
  if (!current) return { success: false, error: "Cette entrée n’existe plus." };
  const restored = revertExampleRecord(current, entry);
  rows.value = rows.value.map(item => item.id === row.id ? restored : item);
  feedback.value = "Modification annulée. L’événement d’origine et son annulation restent dans l’historique.";
  return { success: true };
};
const modes = [{ id: "drawer", label: "Panneau latéral", icon: PanelRight }, { id: "modal", label: "Modale", icon: Square }, { id: "inline", label: "Dans la page", icon: LayoutTemplate }] as const;
</script>

<template>
  <main class="record-demo">
    <nav class="record-demo-nav"><a href="?">YaYaw <span>Table</span></a><span>Composants / Fiche de consultation</span><span class="record-demo-proposal">Proposition</span></nav>
    <header class="record-demo-intro"><p class="record-demo-kicker">LA FICHE DE CONSULTATION</p><h1>Chaque détail.<br><span>Tout le contexte.</span></h1><p>Une entrée lisible, son équipe et son histoire.<br>Consultez les informations, puis modifiez ou supprimez si nécessaire.</p></header>
    <section class="record-demo-workspace">
      <header class="record-demo-controls"><div><h2>Campagnes</h2><p>Cliquez sur l’entrée ou choisissez « Consulter » dans ses actions.</p></div><fieldset><legend>Présentation de la fiche</legend><label v-for="mode in modes" :key="mode.id" :class="{ selected: presentation === mode.id }"><input v-model="presentation" type="radio" name="presentation" :value="mode.id"><component :is="mode.icon" :size="15" aria-hidden="true" />{{ mode.label }}</label></fieldset></header>
      <DataTable :key="presentation" table-type="record-details-demo" :config="config" :details="detailConfig" :data="rows" :get-table-actions="() => actions" :on-revert-activity="revertActivity" locale="fr">
        <template #detail-score="{ value }"><span class="record-demo-score"><progress :value="Number(value)" max="100" aria-label="Préparation de la campagne" />{{ value }} %</span></template>
      </DataTable>
      <div class="record-demo-footer"><span role="status">{{ feedback || 'Données et historique fictifs · Les modifications restent dans cette démo.' }}</span><button type="button" @click="reset"><RotateCcw :size="13" aria-hidden="true" />Réinitialiser</button></div>
    </section>
    <section class="record-demo-capabilities"><div><span>01</span><h3>{{ recordSections.flatMap(section => section.fields).length }} champs, une lecture naturelle</h3><p>Texte, montants, dates, choix, relations, documents, images et données structurées.</p></div><div><span>02</span><h3>Qui a changé quoi, et quand</h3><p>Date de mise à jour, auteur et valeurs avant / après. Les changements de la démo enrichissent l’activité.</p></div><div><span>03</span><h3>À sa place dans votre interface</h3><p>Le même contenu en panneau, en modale ou dans une page. Modifier et supprimer restent à portée de main.</p></div></section>
  </main>
</template>

<style>
body { margin: 0; background: #f8f8fa; color: #202024; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.record-demo { max-width: 1260px; margin: auto; padding: 0 40px 70px; }
.record-demo-nav { display: flex; align-items: center; gap: 30px; height: 88px; border-bottom: 1px solid #e6e6ea; font-size: 12px; color: #777781; }
.record-demo-nav a { color: #202024; font-weight: 750; font-size: 20px; text-decoration: none; letter-spacing: -.8px; }
.record-demo-nav a span { font-weight: 400; color: #8a8a93; }
.record-demo-proposal { margin-left: auto; padding: 4px 10px; border: 1px solid #dcdce5; border-radius: 6px; }
.record-demo-intro { padding: 64px 0 45px; }
.record-demo-kicker { font-size: 10px; letter-spacing: .16em; font-weight: 650; color: #777781; }
.record-demo-intro h1 { font-size: clamp(36px, 4.8vw, 60px); font-weight: 550; line-height: 1.04; letter-spacing: -.055em; margin: 18px 0; }
.record-demo-intro h1 span { color: #9595a0; }
.record-demo-intro > p:last-child { font-size: 14px; line-height: 1.7; color: #62626e; }
.record-demo-workspace { background: #fff; border: 1px solid #e0e0e7; border-radius: 14px; padding: 26px; box-shadow: 0 4px 12px #25253204; }
.record-demo-controls { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 28px; }
.record-demo-controls h2 { margin: 0 0 5px; font-size: 18px; letter-spacing: -.025em; }
.record-demo-controls p { font-size: 12px; margin: 0; color: #777781; }
.record-demo-controls fieldset { display: flex; padding: 3px; gap: 3px; border: 1px solid #e6e6eb; border-radius: 8px; background: #f7f7f9; margin: 0; }
.record-demo-controls legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.record-demo-controls label { position: relative; display: flex; gap: 6px; align-items: center; padding: 8px 10px; border-radius: 5px; font-size: 11px; color: #71717c; cursor: pointer; }
.record-demo-controls label.selected { background: #fff; color: #27272e; box-shadow: 0 1px 4px #0002; }
.record-demo-controls input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.record-demo-controls label:has(:focus-visible) { outline: 2px solid #555; outline-offset: 2px; }
.record-demo-footer { display: flex; gap: 15px; align-items: center; justify-content: space-between; border-top: 1px solid #eeeef2; margin-top: 20px; padding-top: 16px; color: #82828e; font-size: 11px; }
.record-demo-footer button { display: flex; align-items: center; gap: 6px; background: transparent; border: 0; font: inherit; color: #666674; cursor: pointer; }
.record-demo-capabilities { display: grid; grid-template-columns: repeat(3, 1fr); gap: 50px; padding: 38px 8px; }
.record-demo-capabilities span { font-size: 11px; color: #9898a3; }
.record-demo-capabilities h3 { font-size: 13px; font-weight: 600; margin: 12px 0 8px; }
.record-demo-capabilities p { font-size: 12px; color: #82828e; line-height: 1.7; margin: 0; }
.record-demo-score { display: flex; align-items: center; gap: 10px; font-size: 12px; }
.record-demo-score progress { width: 130px; height: 6px; accent-color: #647b59; }
@media (max-width: 700px) { .record-demo { padding: 0 18px 40px; } .record-demo-nav { gap: 15px; } .record-demo-nav > span:nth-child(2) { display: none; } .record-demo-intro { padding: 35px 0; } .record-demo-workspace { padding: 16px; } .record-demo-capabilities { grid-template-columns: 1fr; gap: 25px; } .record-demo-footer { align-items: flex-start; } }
</style>
