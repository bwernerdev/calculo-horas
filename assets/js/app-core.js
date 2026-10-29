// Constantes, cliente Supabase, estado compartilhado e utilitários básicos.
const THEME_PREFERENCE_KEY = "controle-horas-tema-v1";
const REMEMBERED_EMAIL_KEY = "controle-horas-email-v1";
const MANUAL_BALANCE_KEY = "controle-horas-simulador-v1";
const TYPES = { trabalho:"Trabalho", folga:"Folga", feriado:"Feriado", ferias:"Férias", falta:"Falta", compensacao:"Compensação" };
const $ = (selector) => document.querySelector(selector);
const appStorage = window.AppStorage;
const storageWarning = $("#storage-warning");
storageWarning.hidden = appStorage.persistent;
appStorage.onFailure = () => { storageWarning.hidden = false; };
const form = $("#hours-form");
const { toMinutes, toClock, duration, signed } = HoursCalculator;
const { normalizeClock, parseDuration, formatDuration } = HoursTimeInput;
const FIXED_BREAK_MINUTES = 60;
const MAX_DAILY_WORK_MINUTES = 10 * 60;
const SUGGESTED_DAILY_LIMIT_MINUTES = 9 * 60 + 45;
const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024;
const MAX_BACKUP_RECORDS = 5000;
const MAX_BACKUP_PHOTO_LENGTH = 2_790_000;
const BACKUP_REMINDER_DAYS = 30;
const BACKUP_SNOOZE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const authLinkType = new URLSearchParams(window.location.hash.slice(1)).get("type") || new URLSearchParams(window.location.search).get("type");
let requiresPasswordSetup = authLinkType === "invite" || authLinkType === "recovery";
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  const configurationMessage = document.querySelector("#auth-message");
  configurationMessage.textContent = "Este ambiente ainda não possui um Supabase de teste configurado.";
  configurationMessage.hidden = false;
  throw new Error("Configuração do Supabase ausente para este ambiente.");
}
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storage:appStorage }
});
if (window.APP_CONFIG?.errorReporting && window.AppMonitor) {
  AppMonitor.setReporter(async (report) => {
    const { error } = await supabaseClient.from("client_errors").upsert(report, { onConflict:"event_id", ignoreDuplicates:true });
    if (error) throw error;
  });
}
function captureError(error, source, context = {}) {
  window.AppMonitor?.capture(error, { source, ...context });
}
let repository;
let useCases;
let records = [];
let settings = { target:528, break:FIXED_BREAK_MINUTES, theme:document.documentElement.dataset.theme === "dark" ? "dark" : "light", manualBalances:{} };
let pendingPhotos = { entrada:"", saida:"" };
let capturedPhoto = "";
let cameraStream;
let loadedUserId = "";
let applicationLoad;
let applicationGeneration = 0;
const manualBalanceSaveTimers=new Map();
const manualBalanceVersions=new Map();
let settingsSaveChain=Promise.resolve();
let historyRange=null;
let forpontoBlocks=[];
let forpontoGeneration=0;

const rememberedEmail = appStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
$("#auth-email").value = rememberedEmail;
$("#remember-access").checked = Boolean(rememberedEmail);

function localDate(date = new Date()) { const offset = date.getTimezoneOffset() * 60000; return new Date(date - offset).toISOString().slice(0,10); }
function escapeCell(value) { const text = String(value ?? ""); return /[";,\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text; }

function calculate(record) { return HoursCalculator.calculate(record,settings.target); }
function recordPhotos(record) { return record.photos || { entrada:record.photo || "", saida:"" }; }
