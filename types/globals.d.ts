// Globais expostos pelos módulos UMD (`root.X = ...`) e tipos compartilhados via JSDoc.
interface HoursRecord {
  id: string;
  date: string; // AAAA-MM-DD
  type: "trabalho" | "folga" | "feriado" | "ferias" | "falta" | "compensacao";
  start: string; // HH:MM ou ""
  end: string;
  break: number; // minutos
  importData?: { source?: string; label?: string; punches?: string[]; officialBalanceMinutes?: number | null };
  photos?: { entrada: string; saida: string };
}

interface AppConfig {
  environment: string;
  version: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  errorReporting: boolean;
}

declare var HoursCalculator: any;
declare var HoursCycle: any;
declare var HoursRepository: any;
declare var HoursUseCases: any;
declare var HoursTimeInput: any;
declare var HoursInsights: any;
declare var HoursXlsx: any;
declare var ForpontoImport: any;
interface Window {
  APP_CONFIG: Readonly<AppConfig>;
  AppMonitor: any;
  AppStorage: any;
}
