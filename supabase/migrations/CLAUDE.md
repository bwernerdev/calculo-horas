# supabase/migrations
Aplicar em ordem; nunca editar migração já aplicada (criar nova com timestamp).
1. `20260915000000_initial_schema` — tabelas `records`, `settings` (target_minutes, theme, balance_adjustments), RLS, Storage de fotos.
2. `20260915000100_client_error_monitoring` — tabela `client_errors` (insert pelo próprio usuário, limites de tamanho).
3. `20260916000000_forponto_import` — coluna `import_data` (jsonb, validada), tipo `compensacao`.
4. `20260916010000_atomic_forponto_import` — RPC `import_forponto_records(p_records, p_update_existing)`: importação transacional (máx. 5000), preserva fotos/IDs.
