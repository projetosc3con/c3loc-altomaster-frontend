# Estrutura do Banco de Dados - RentDesk

Este documento descreve a estrutura de tabelas, relacionamentos, chaves primárias/estrangeiras, gatilhos (triggers) e funções do banco de dados PostgreSQL/Supabase do projeto **RentDesk**.

## Sumário das Tabelas

Abaixo estão listadas as 46 tabelas ativas no esquema `public` do banco de dados:

- [`users_profiles`](#users-profiles)
- [`clients`](#clients)
- [`equipments`](#equipments)
- [`parts`](#parts)
- [`rental_invoices`](#rental-invoices)
- [`payments`](#payments)
- [`bills`](#bills)
- [`nfe_imports`](#nfe-imports)
- [`asaas_webhook_logs`](#asaas-webhook-logs)
- [`service_orders`](#service-orders)
- [`service_order_parts`](#service-order-parts)
- [`invoice_year_counters`](#invoice-year-counters)
- [`hr_job_levels`](#hr-job-levels)
- [`hr_positions`](#hr-positions)
- [`hr_salary_ranges`](#hr-salary-ranges)
- [`hr_employee_positions`](#hr-employee-positions)
- [`hr_document_types`](#hr-document-types)
- [`hr_employee_documents`](#hr-employee-documents)
- [`hr_integration_types`](#hr-integration-types)
- [`hr_employee_integrations`](#hr-employee-integrations)
- [`hr_training_catalog`](#hr-training-catalog)
- [`hr_employee_trainings`](#hr-employee-trainings)
- [`crm_leads`](#crm-leads)
- [`crm_contacts`](#crm-contacts)
- [`crm_pipelines`](#crm-pipelines)
- [`crm_pipeline_stages`](#crm-pipeline-stages)
- [`crm_deals`](#crm-deals)
- [`crm_deal_activities`](#crm-deal-activities)
- [`crm_task_types`](#crm-task-types)
- [`crm_tasks`](#crm-tasks)
- [`erp_company_settings`](#erp-company-settings)
- [`crm_deal_contract_forms`](#crm-deal-contract-forms)
- [`crm_deal_contracts`](#crm-deal-contracts)
- [`logistics_triage_photos`](#logistics-triage-photos)
- [`hr_epi_catalog`](#hr-epi-catalog)
- [`hr_epi_record_items`](#hr-epi-record-items)
- [`hr_epi_records`](#hr-epi-records)
- [`hr_position_document_types`](#hr-position-document-types)
- [`hr_time_records`](#hr-time-records)
- [`hr_timesheet_reports`](#hr-timesheet-reports)
- [`hr_vacation_approvals`](#hr-vacation-approvals)
- [`hr_vacation_installments`](#hr-vacation-installments)
- [`hr_vacation_requests`](#hr-vacation-requests)
- [`service_order_labor`](#service-order-labor)
- [`invoice_nfse`](#invoice-nfse)
- [`stock_movements`](#stock-movements)

---

## Detalhes das Tabelas

### users_profiles

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | - | 🔑 PK |
| `full_name` | `text` | Não | - |  |
| `cpf` | `text` | Sim | - | ✨ Unique |
| `birth_date` | `date` | Sim | - |  |
| `phone` | `text` | Sim | - |  |
| `email` | `text` | Não | - | ✨ Unique |
| `address_street` | `text` | Sim | - |  |
| `address_number` | `text` | Sim | - |  |
| `address_complement` | `text` | Sim | - |  |
| `address_city` | `text` | Sim | - |  |
| `address_state` | `text` | Sim | - |  |
| `address_zip` | `text` | Sim | - |  |
| `role_title` | `text` | Sim | - |  |
| `access_level` | `USER-DEFINED` | Sim | `'Financeiro'::access_level_type` | Valores: ["Administrador", "Diretoria", "Gerente", "Comercial", "Logística", "Manutenção", "Financeiro", "Recursos Humanos", "Usuário"] |
| `active` | `boolean` | Sim | `true` |  |
| `created_at` | `timestamp with time zone` | Sim | `now()` |  |
| `updated_at` | `timestamp with time zone` | Sim | `now()` |  |
| `photo_url` | `text` | Sim | - |  |
| `password_set` | `boolean` | Sim | `false` |  |

#### Relacionamentos de Saída (Chaves Estrangeiras Referenciadas)

* A coluna `id` aponta para [`auth.users.id`](#auth.users)`(id)` (Constraint: `users_profiles_id_fkey`)

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`bills.created_by`](#bills)`(created_by)` aponta para a coluna local `id` (Constraint: `bills_created_by_fkey`)
* [`service_orders.executed_by`](#service-orders)`(executed_by)` aponta para a coluna local `id` (Constraint: `service_orders_executed_by_fkey`)
* [`rental_invoices.created_by`](#rental-invoices)`(created_by)` aponta para a coluna local `id` (Constraint: `rental_invoices_created_by_fkey`)
* [`hr_employee_positions.user_id`](#hr-employee-positions)`(user_id)` aponta para a coluna local `id` (Constraint: `hr_employee_positions_user_id_fkey`)
* [`hr_employee_positions.registered_by`](#hr-employee-positions)`(registered_by)` aponta para a coluna local `id` (Constraint: `hr_employee_positions_registered_by_fkey`)
* [`hr_employee_documents.user_id`](#hr-employee-documents)`(user_id)` aponta para a coluna local `id` (Constraint: `hr_employee_documents_user_id_fkey`)
* [`hr_employee_documents.registered_by`](#hr-employee-documents)`(registered_by)` aponta para a coluna local `id` (Constraint: `hr_employee_documents_registered_by_fkey`)
* [`hr_employee_integrations.user_id`](#hr-employee-integrations)`(user_id)` aponta para a coluna local `id` (Constraint: `hr_employee_integrations_user_id_fkey`)
* [`hr_employee_integrations.registered_by`](#hr-employee-integrations)`(registered_by)` aponta para a coluna local `id` (Constraint: `hr_employee_integrations_registered_by_fkey`)
* [`hr_employee_trainings.user_id`](#hr-employee-trainings)`(user_id)` aponta para a coluna local `id` (Constraint: `hr_employee_trainings_user_id_fkey`)
* [`hr_employee_trainings.registered_by`](#hr-employee-trainings)`(registered_by)` aponta para a coluna local `id` (Constraint: `hr_employee_trainings_registered_by_fkey`)
* [`crm_leads.owner_id`](#crm-leads)`(owner_id)` aponta para a coluna local `id` (Constraint: `crm_leads_owner_id_fkey`)
* [`crm_deals.owner_id`](#crm-deals)`(owner_id)` aponta para a coluna local `id` (Constraint: `crm_deals_owner_id_fkey`)
* [`crm_deal_activities.performed_by`](#crm-deal-activities)`(performed_by)` aponta para a coluna local `id` (Constraint: `crm_deal_activities_performed_by_fkey`)
* [`crm_tasks.assigned_to`](#crm-tasks)`(assigned_to)` aponta para a coluna local `id` (Constraint: `crm_tasks_assigned_to_fkey`)
* [`crm_tasks.created_by`](#crm-tasks)`(created_by)` aponta para a coluna local `id` (Constraint: `crm_tasks_created_by_fkey`)
* [`crm_deal_contract_forms.created_by`](#crm-deal-contract-forms)`(created_by)` aponta para a coluna local `id` (Constraint: `crm_deal_contract_forms_created_by_fkey`)
* [`crm_deal_contract_forms.updated_by`](#crm-deal-contract-forms)`(updated_by)` aponta para a coluna local `id` (Constraint: `crm_deal_contract_forms_updated_by_fkey`)
* [`crm_deal_contracts.generated_by`](#crm-deal-contracts)`(generated_by)` aponta para a coluna local `id` (Constraint: `crm_deal_contracts_generated_by_fkey`)
* [`crm_deal_contracts.signed_uploaded_by`](#crm-deal-contracts)`(signed_uploaded_by)` aponta para a coluna local `id` (Constraint: `crm_deal_contracts_signed_uploaded_by_fkey`)
* [`logistics_triage_photos.uploaded_by`](#logistics-triage-photos)`(uploaded_by)` aponta para a coluna local `id` (Constraint: `logistics_triage_photos_uploaded_by_fkey`)
* [`hr_time_records.user_id`](#hr-time-records)`(user_id)` aponta para a coluna local `id` (Constraint: `hr_time_records_user_id_fkey`)
* [`hr_time_records.adjusted_by`](#hr-time-records)`(adjusted_by)` aponta para a coluna local `id` (Constraint: `hr_time_records_adjusted_by_fkey`)
* [`hr_timesheet_reports.user_id`](#hr-timesheet-reports)`(user_id)` aponta para a coluna local `id` (Constraint: `hr_timesheet_reports_user_id_fkey`)
* [`hr_timesheet_reports.generated_by`](#hr-timesheet-reports)`(generated_by)` aponta para a coluna local `id` (Constraint: `hr_timesheet_reports_generated_by_fkey`)
* [`hr_timesheet_reports.approved_by`](#hr-timesheet-reports)`(approved_by)` aponta para a coluna local `id` (Constraint: `hr_timesheet_reports_approved_by_fkey`)
* [`hr_vacation_requests.user_id`](#hr-vacation-requests)`(user_id)` aponta para a coluna local `id` (Constraint: `hr_vacation_requests_user_id_fkey`)
* [`hr_vacation_approvals.approver_id`](#hr-vacation-approvals)`(approver_id)` aponta para a coluna local `id` (Constraint: `hr_vacation_approvals_approver_id_fkey`)
* [`hr_epi_records.user_id`](#hr-epi-records)`(user_id)` aponta para a coluna local `id` (Constraint: `hr_epi_records_user_id_fkey`)
* [`hr_epi_records.uploaded_by`](#hr-epi-records)`(uploaded_by)` aponta para a coluna local `id` (Constraint: `hr_epi_records_uploaded_by_fkey`)

#### Índices (Indexes)

* **`users_profiles_cpf_key`**
  ```sql
  CREATE UNIQUE INDEX users_profiles_cpf_key ON public.users_profiles USING btree (cpf)
  ```
* **`users_profiles_email_key`**
  ```sql
  CREATE UNIQUE INDEX users_profiles_email_key ON public.users_profiles USING btree (email)
  ```

#### Gatilhos (Triggers)

* **`update_users_profiles_updated_at`**
  ```sql
  CREATE TRIGGER update_users_profiles_updated_at BEFORE UPDATE ON public.users_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  ```

---

### clients

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `company_name` | `text` | Não | - |  |
| `cnpj` | `text` | Não | - | ✨ Unique |
| `contact_name` | `text` | Sim | - |  |
| `phone` | `text` | Sim | - |  |
| `email` | `text` | Sim | - |  |
| `address_street` | `text` | Sim | - |  |
| `address_number` | `text` | Sim | - |  |
| `address_complement` | `text` | Sim | - |  |
| `address_city` | `text` | Sim | - |  |
| `address_state` | `text` | Sim | - |  |
| `address_zip` | `text` | Sim | - |  |
| `active` | `boolean` | Sim | `true` |  |
| `created_at` | `timestamp with time zone` | Sim | `now()` |  |
| `updated_at` | `timestamp with time zone` | Sim | `now()` |  |
| `state_subscription` | `text` | Sim | - |  |
| `average_score` | `numeric` | Sim | `0` |  |
| `documentation_url` | `text` | Sim | - |  |
| `asaas_customer_id` | `text` | Sim | - |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`crm_deals.client_id`](#crm-deals)`(client_id)` aponta para a coluna local `id` (Constraint: `crm_deals_client_id_fkey`)
* [`crm_contacts.client_id`](#crm-contacts)`(client_id)` aponta para a coluna local `id` (Constraint: `crm_contacts_client_id_fkey`)
* [`rental_invoices.client_id`](#rental-invoices)`(client_id)` aponta para a coluna local `id` (Constraint: `rental_invoices_client_id_fkey`)
* [`hr_employee_integrations.client_id`](#hr-employee-integrations)`(client_id)` aponta para a coluna local `id` (Constraint: `hr_employee_integrations_client_id_fkey`)
* [`crm_leads.converted_client_id`](#crm-leads)`(converted_client_id)` aponta para a coluna local `id` (Constraint: `crm_leads_converted_client_id_fkey`)
* [`bills.client_id`](#bills)`(client_id)` aponta para a coluna local `id` (Constraint: `bills_client_id_fkey`)
* [`payments.client_id`](#payments)`(client_id)` aponta para a coluna local `id` (Constraint: `payments_client_id_fkey`)

#### Índices (Indexes)

* **`clients_cnpj_key`**
  ```sql
  CREATE UNIQUE INDEX clients_cnpj_key ON public.clients USING btree (cnpj)
  ```

#### Gatilhos (Triggers)

* **`update_clients_updated_at`**
  ```sql
  CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  ```

---

### equipments

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `asset_number` | `text` | Não | - | ✨ Unique |
| `name` | `text` | Não | - |  |
| `type` | `text` | Sim | - |  |
| `model` | `text` | Sim | - |  |
| `serial_number` | `text` | Sim | - |  |
| `height` | `numeric` | Sim | - |  |
| `status` | `USER-DEFINED` | Sim | `'Disponível'::equipment_status_type` | Valores: ["Disponível", "Locado", "Em Manutenção", "Inativo"] |
| `manufacture_year` | `integer` | Sim | - |  |
| `value` | `numeric` | Sim | - |  |
| `unit` | `text` | Sim | `'un'::text` |  |
| `photo_url` | `text` | Sim | - |  |
| `notes` | `text` | Sim | - |  |
| `invoice_number` | `text` | Sim | - | Número da NF-e de aquisição |
| `nfe_access_key` | `text` | Sim | - | Chave de acesso da NF-e (44 dígitos) |
| `supplier_name` | `text` | Sim | - | Fornecedor / Emitente da NF-e |
| `supplier_cnpj` | `text` | Sim | - | CNPJ do fornecedor |
| `product_code` | `text` | Sim | - | Código do produto no fornecedor |
| `ncm` | `text` | Sim | - | Código NCM/SH fiscal |
| `cst` | `text` | Sim | - | CST ICMS |
| `cfop` | `text` | Sim | - | CFOP da operação |
| `tax_details` | `jsonb` | Sim | - | Detalhamento de impostos (ICMS, PIS, COFINS, IPI) |
| `purchase_date` | `date` | Sim | - | Data de emissão/aquisição da NF-e |
| `created_by` | `uuid` | Sim | - | UID do usuário / criador do registro |
| `created_at` | `timestamp with time zone` | Sim | `now()` |  |
| `updated_at` | `timestamp with time zone` | Sim | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`rental_invoices.equipment_id`](#rental-invoices)`(equipment_id)` aponta para a coluna local `id` (Constraint: `rental_invoices_equipment_id_fkey`)
* [`service_orders.equipment_id`](#service-orders)`(equipment_id)` aponta para a coluna local `id` (Constraint: `service_orders_equipment_id_fkey`)

#### Índices (Indexes)

* **`equipments_asset_number_key`**
  ```sql
  CREATE UNIQUE INDEX equipments_asset_number_key ON public.equipments USING btree (asset_number)
  ```

#### Gatilhos (Triggers)

* **`update_equipments_updated_at`**
  ```sql
  CREATE TRIGGER update_equipments_updated_at BEFORE UPDATE ON public.equipments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  ```

---

### parts

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `internal_code` | `text` | Não | - | ✨ Unique; Prefixo por categoria: P (Peça), C (Consumo), E (EPI), O (Outros) |
| `description` | `text` | Não | - |  |
| `category` | `text` | Não | `'Peça'::text` | CHECK: category IN ('Peça', 'Consumo', 'EPI', 'Outros') |
| `unit` | `text` | Não | `'UN'::text` | Ex: UN, L, KG, M, PAR, CX, RL, JG, PCT |
| `part_number` | `text` | Sim | - | Referência do fabricante / PN |
| `quantity` | `numeric` | Sim | `0` | Quantidade em estoque (permite decimais para M, L, KG) |
| `unit_value` | `numeric` | Sim | `0` |  |
| `total_value` | `numeric` | Sim | `(quantity * unit_value)` |  |
| `notes` | `text` | Sim | - |  |
| `invoice_number` | `text` | Sim | - | Número da NF-e |
| `nfe_access_key` | `text` | Sim | - | Chave de acesso da NF-e |
| `supplier_name` | `text` | Sim | - | Razão social do fornecedor |
| `supplier_cnpj` | `text` | Sim | - | CNPJ do fornecedor |
| `ncm` | `text` | Sim | - | Código NCM |
| `cfop` | `text` | Sim | - | CFOP da operação |
| `created_by` | `uuid` | Sim | - | UID do usuário / criador do registro |
| `created_at` | `timestamp with time zone` | Sim | `now()` |  |
| `updated_at` | `timestamp with time zone` | Sim | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`service_order_parts.part_id`](#service-order-parts)`(part_id)` aponta para a coluna local `id` (Constraint: `service_order_parts_part_id_fkey`)

#### Índices (Indexes)

* **`parts_internal_code_key`**
  ```sql
  CREATE UNIQUE INDEX parts_internal_code_key ON public.parts USING btree (internal_code)
  ```

#### Gatilhos (Triggers)

* **`update_parts_updated_at`**
  ```sql
  CREATE TRIGGER update_parts_updated_at BEFORE UPDATE ON public.parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  ```

---

### rental_invoices

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `client_id` | `uuid` | Sim | - |  |
| `client_name` | `text` | Sim | - |  |
| `cnpj` | `text` | Sim | - |  |
| `equipment_id` | `uuid` | Sim | - |  |
| `equipment_name` | `text` | Sim | - |  |
| `equipment_type` | `text` | Sim | - |  |
| `equipment_size` | `text` | Sim | - |  |
| `asset_number` | `text` | Sim | - |  |
| `work_site` | `text` | Sim | - |  |
| `billing_period_start` | `date` | Sim | - |  |
| `billing_period_end` | `date` | Sim | - |  |
| `billing_status` | `USER-DEFINED` | Sim | `'Pendente'::billing_status_type` | Valores: ["Pendente", "Faturado", "Emitida", "Cancelada"] |
| `return_date` | `date` | Sim | - |  |
| `cost_rental` | `numeric` | Sim | `0` |  |
| `cost_insurance` | `numeric` | Sim | `0` |  |
| `cost_freight` | `numeric` | Sim | `0` |  |
| `cost_rcd` | `numeric` | Sim | `0` |  |
| `cost_third_party` | `numeric` | Sim | `0` |  |
| `cost_training` | `numeric` | Sim | `0` |  |
| `total_value` | `numeric` | Sim | `0` | Valor total da fatura (calculado) |
| `due_date` | `date` | Sim | - |  |
| `payment_method` | `text` | Sim | - |  |
| `billing_method` | `text` | Sim | `'ASAAS'` | Valores: 'ASAAS', 'MANUAL' |
| `document_type` | `text` | Sim | `'FATURA_LOCACAO'` | Valores: 'FATURA_LOCACAO', 'NFSE' |
| `manual_due_date` | `date` | Sim | - | Data de vencimento no lançamento manual |
| `fatura_pdf_url` | `text` | Sim | - | Link/Storage URL do PDF da Fatura de Locação gerada |
| `bank_reconciliation_date` | `date` | Sim | - |  |
| `reconciliation_status` | `USER-DEFINED` | Sim | `'Atrasado'::reconciliation_status_type` | Valores: ["Pendente", "Atrasado", "Recebido", "Divergente", "No prazo"] |
| `notes` | `text` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Sim | `now()` |  |
| `updated_at` | `timestamp with time zone` | Sim | `now()` |  |
| `created_by` | `uuid` | Sim | - |  |
| `invoice_number` | `text` | Sim | - |  |
| `client_score` | `integer` | Sim | - | CHECK: client_score >= 1 AND client_score <= 5 |
| `deal_id` | `uuid` | Sim | - | Chave estrangeira para o negócio no CRM |

#### Relacionamentos de Saída (Chaves Estrangeiras Referenciadas)

* A coluna `deal_id` aponta para [`crm_deals.id`](#crm-deals)`(id)` (Constraint: `rental_invoices_deal_id_fkey`)
* A coluna `client_id` aponta para [`clients.id`](#clients)`(id)` (Constraint: `rental_invoices_client_id_fkey`)
* A coluna `equipment_id` aponta para [`equipments.id`](#equipments)`(id)` (Constraint: `rental_invoices_equipment_id_fkey`)
* A coluna `created_by` aponta para [`users_profiles.id`](#users-profiles)`(id)` (Constraint: `rental_invoices_created_by_fkey`)

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`bills.rental_invoice_id`](#bills)`(rental_invoice_id)` aponta para a coluna local `id` (Constraint: `bills_rental_invoice_id_fkey`)
* [`invoice_nfse.invoice_id`](#invoice-nfse)`(invoice_id)` aponta para a coluna local `id` (Constraint: `invoice_nfse_invoice_id_fkey`)
* [`payments.invoice_id`](#payments)`(invoice_id)` aponta para a coluna local `id` (Constraint: `payments_invoice_id_fkey`)
* [`crm_deal_contracts.rental_invoice_id`](#crm-deal-contracts)`(rental_invoice_id)` aponta para a coluna local `id` (Constraint: `crm_deal_contracts_rental_invoice_id_fkey`)
* [`crm_deals.rental_invoice_id`](#crm-deals)`(rental_invoice_id)` aponta para a coluna local `id` (Constraint: `crm_deals_rental_invoice_id_fkey`)
* [`rental_invoice_equipments.rental_invoice_id`](#rental-invoice-equipments)`(rental_invoice_id)` aponta para a coluna local `id` (Constraint: `rental_invoice_equipments_rental_invoice_id_fkey`)

#### Gatilhos (Triggers)

* **`update_rental_invoices_updated_at`**
  ```sql
  CREATE TRIGGER update_rental_invoices_updated_at BEFORE UPDATE ON public.rental_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  ```
* **`trg_set_invoice_number`**
  ```sql
  CREATE TRIGGER trg_set_invoice_number BEFORE INSERT ON public.rental_invoices FOR EACH ROW WHEN ((new.invoice_number IS NULL)) EXECUTE FUNCTION generate_invoice_number()
  ```
* **`tr_update_client_score`**
  ```sql
  CREATE TRIGGER tr_update_client_score AFTER INSERT OR UPDATE OF client_score ON public.rental_invoices FOR EACH ROW EXECUTE FUNCTION update_client_average_score()
  ```

---

### rental_invoice_equipments

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)
* **Propósito:** Armazena cada equipamento vinculado a uma fatura de locação (`rental_invoices`) ou contrato de CRM (`crm_deal_contracts`), permitindo que uma locação contenha múltiplos equipamentos com datas e valores individuais.

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `rental_invoice_id` | `uuid` | Sim | - | Chave estrangeira para `rental_invoices.id` (ON DELETE CASCADE) |
| `deal_contract_id` | `uuid` | Sim | - | Chave estrangeira para `crm_deal_contracts.id` (ON DELETE CASCADE) |
| `equipment_id` | `uuid` | Não | - | Chave estrangeira para `equipments.id` (ON DELETE RESTRICT) |
| `equipment_name` | `text` | Sim | - | Nome denormalizado do equipamento |
| `equipment_type` | `text` | Sim | - | Tipo/Modelo do equipamento |
| `equipment_size` | `text` | Sim | - | Altura/Tamanho do equipamento |
| `asset_number` | `text` | Sim | - | Número de patrimônio |
| `billing_period_start` | `date` | Não | - | Início da locação deste equipamento |
| `billing_period_end` | `date` | Não | - | Fim previsto da locação deste equipamento |
| `return_date` | `date` | Sim | - | Data de devolução real/efetiva |
| `cost_rental` | `numeric` | Sim | `0` | Valor da locação deste item |
| `cost_insurance` | `numeric` | Sim | `0` | Valor do seguro deste item |
| `cost_freight` | `numeric` | Sim | `0` | Valor do frete deste item |
| `cost_rcd` | `numeric` | Sim | `0` | Valor de RCD deste item |
| `cost_third_party` | `numeric` | Sim | `0` | Valor de terceiros deste item |
| `cost_training` | `numeric` | Sim | `0` | Valor de treinamento deste item |
| `total_value` | `numeric` | Sim | `0` | Valor total consolidado deste equipamento |
| `notes` | `text` | Sim | - | Observações adicionais do item |
| `created_at` | `timestamp with time zone` | Sim | `now()` |  |
| `updated_at` | `timestamp with time zone` | Sim | `now()` |  |

#### Relacionamentos de Saída (Chaves Estrangeiras Referenciadas)

* A coluna `rental_invoice_id` aponta para [`rental_invoices.id`](#rental-invoices)`(id)` (Constraint: `rental_invoice_equipments_rental_invoice_id_fkey`)
* A coluna `deal_contract_id` aponta para [`crm_deal_contracts.id`](#crm-deal-contracts)`(id)` (Constraint: `rental_invoice_equipments_deal_contract_id_fkey`)
* A coluna `equipment_id` aponta para [`equipments.id`](#equipments)`(id)` (Constraint: `rental_invoice_equipments_equipment_id_fkey`)

#### Índices (Indexes)

* **`idx_rental_invoice_equipments_invoice`**
  ```sql
  CREATE INDEX idx_rental_invoice_equipments_invoice ON public.rental_invoice_equipments USING btree (rental_invoice_id)
  ```
* **`idx_rental_invoice_equipments_contract`**
  ```sql
  CREATE INDEX idx_rental_invoice_equipments_contract ON public.rental_invoice_equipments USING btree (deal_contract_id)
  ```
* **`idx_rental_invoice_equipments_equipment`**
  ```sql
  CREATE INDEX idx_rental_invoice_equipments_equipment ON public.rental_invoice_equipments USING btree (equipment_id)
  ```

---

### payments

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)
* **Propósito:** Cumpre a arquitetura PaymentProfile → Payment → Invoice: gerencia o status financeiro real com o Asaas e as baixas manuais. Uma fatura pode ser paga em N parcelas, logo 1 `rental_invoices` tem N `payments`.

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `invoice_id` | `uuid` | Não | - |  |
| `client_id` | `uuid` | Não | - |  |
| `asaas_payment_id` | `text` | Sim | - | ID gerado pelo Asaas (ex: pay_000001); ID gerado pelo Asaas (ex: `pay_000001`) |
| `billing_type` | `text` | Não | `'BOLETO'::text` | Ex: PIX, BOLETO, CREDIT_CARD |
| `value` | `numeric` | Não | - | Valor bruto cobrado |
| `net_value` | `numeric` | Sim | - | Valor liquido (apos taxa do Asaas) |
| `due_date` | `date` | Não | - | Data de vencimento |
| `payment_date` | `date` | Sim | - | Data em que o pagamento foi efetivado |
| `status` | `text` | Não | `'PENDING'::text` | Valores do Asaas: PENDING, RECEIVED, OVERDUE, CANCELLED |
| `is_manual_reconciliation` | `boolean` | Não | `false` | true se o cliente utilizou o botao Recebido por fora (Baixa Manual); `true` se o cliente utilizou o botão "Recebido por fora" (Baixa Manual) |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `net_value_projected` | `numeric` | Sim | - |  |
| `invoice_url` | `text` | Sim | - |  |
| `bank_slip_url` | `text` | Sim | - |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`bills.payment_id`](#bills)`(payment_id)` aponta para a coluna local `id` (Constraint: `bills_payment_id_fkey`)

#### Índices (Indexes)

* **`idx_payments_asaas_payment_id`**
  ```sql
  CREATE INDEX idx_payments_asaas_payment_id ON public.payments USING btree (asaas_payment_id)
  ```
* **`idx_payments_client_id`**
  ```sql
  CREATE INDEX idx_payments_client_id ON public.payments USING btree (client_id)
  ```
* **`idx_payments_invoice_id`**
  ```sql
  CREATE INDEX idx_payments_invoice_id ON public.payments USING btree (invoice_id)
  ```
* **`idx_payments_status`**
  ```sql
  CREATE INDEX idx_payments_status ON public.payments USING btree (status)
  ```
* **`payments_invoice_active_unique_idx`**
  ```sql
  CREATE UNIQUE INDEX payments_invoice_active_unique_idx ON public.payments USING btree (invoice_id) WHERE (status <> ALL (ARRAY['CANCELLED'::text, 'REFUNDED'::text]))
  ```

---

### bills

* **Segurança de Nível de Linha (RLS):** Desabilitada (Disabled)
* **Propósito:** Tabela central de contas a pagar e receber (extrato financeiro e conciliação bancária). Armazena lançamentos originados do Asaas (após confirmação de recebimento) e lançamentos manuais com conciliação contra extrato do Banco do Brasil.

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `origin` | `text` | Não | - | CHECK: origin = ANY (ARRAY['ASAAS'::text, 'MANUAL'::text, 'NFE'::text]) |
| `type` | `text` | Não | `'receivable'::text` | CHECK: type = ANY (ARRAY['receivable'::text, 'payable'::text]) |
| `rental_invoice_id` | `uuid` | Sim | - |  |
| `payment_id` | `uuid` | Sim | - |  |
| `client_id` | `uuid` | Sim | - |  |
| `counterparty_name` | `text` | Sim | - |  |
| `description` | `text` | Sim | - |  |
| `gross_value` | `numeric` | Não | - |  |
| `fee_amount` | `numeric` | Sim | `0` |  |
| `net_value` | `numeric` | Não | - |  |
| `due_date` | `date` | Sim | - |  |
| `pix_end_to_end_id` | `text` | Sim | - |  |
| `bank_transaction_date` | `date` | Sim | - |  |
| `bank_raw_snapshot` | `jsonb` | Sim | - |  |
| `status` | `text` | Não | `'Pendente'::text` | CHECK: status = ANY (ARRAY['Pendente'::text, 'Atrasado'::text, 'Recebido'::text, 'Divergente'::text, 'No prazo'::text]) |
| `reconciled_at` | `timestamp with time zone` | Sim | - |  |
| `created_by` | `uuid` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |
| `barcode` | `text` | Sim | - |  |

---

### nfe_imports

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)
* **Propósito:** Histórico, compliance e auditoria de todas as Notas Fiscais Eletrônicas (NF-e de entrada ou saída) importadas em XML no sistema, prevenindo duplicidade de chave de acesso e mantendo rastreabilidade total.

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `access_key` | `text` | Não | - | ✨ Unique; Chave de acesso de 44 dígitos da NF-e |
| `invoice_number` | `text` | Não | - | Número da NF-e |
| `series` | `text` | Sim | - | Série da NF-e |
| `operation_type` | `text` | Não | `'entrada'::text` | 'entrada' ou 'saida' |
| `issue_date` | `timestamp with time zone` | Não | - | Data de emissão da NF-e |
| `issuer_name` | `text` | Não | - | Razão Social do Emitente |
| `issuer_cnpj` | `text` | Não | - | CNPJ do Emitente |
| `recipient_name` | `text` | Sim | - | Razão Social do Destinatário |
| `recipient_cnpj` | `text` | Sim | - | CNPJ do Destinatário |
| `total_products` | `numeric` | Não | `0` | Valor total dos produtos |
| `total_invoice` | `numeric` | Não | `0` | Valor total da NF-e |
| `payment_type` | `text` | Não | `'a_vista'::text` | 'a_vista', 'parcelado' ou 'nenhum' |
| `installments_count` | `integer` | Não | `1` | Quantidade de parcelas geradas em bills |
| `raw_xml` | `text` | Sim | - | Conteúdo bruto do XML para compliance |
| `parsed_json` | `jsonb` | Sim | - | Objeto JSON normalizado com itens e tributos |
| `destination_summary` | `jsonb` | Sim | - | Resumo: equipments_created, parts_created, parts_updated, bills_created |
| `created_by` | `uuid` | Sim | - | Usuário responsável pela importação |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Saída (Chaves Estrangeiras Referenciadas)

* A coluna `created_by` aponta para [`users_profiles.id`](#users-profiles)`(id)` (Constraint: `nfe_imports_created_by_fkey`)

#### Índices (Indexes)

* **`nfe_imports_access_key_key`**
  ```sql
  CREATE UNIQUE INDEX nfe_imports_access_key_key ON public.nfe_imports USING btree (access_key)
  ```

---

### asaas_webhook_logs

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)
* **Propósito:** Auditoria e resiliência para processamento assíncrono via webhook — evita perder atualizações de pagamento ou transferências enviadas pelo Asaas.

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `event_id` | `text` | Não | - | ✨ Unique; ID unico do evento do Asaas (evita duplicidade); ID único do evento do Asaas (evita duplicidade) |
| `event_type` | `text` | Não | - | Ex: PAYMENT_RECEIVED, PAYMENT_OVERDUE |
| `payment_id` | `text` | Não | - | Referencia logica a payments.asaas_payment_id — sem constraint de FK formal no banco; Referência lógica a `payments.asaas_payment_id` |
| `payload` | `jsonb` | Não | - | JSON completo recebido do Asaas |
| `processed` | `boolean` | Não | `false` | true apos atualizar a tabela payments com sucesso; `true` após atualizar a tabela `payments`/`bills` com sucesso |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`idx_asaas_webhook_logs_payment_id`**
  ```sql
  CREATE INDEX idx_asaas_webhook_logs_payment_id ON public.asaas_webhook_logs USING btree (payment_id)
  ```
* **`idx_asaas_webhook_logs_processed`**
  ```sql
  CREATE INDEX idx_asaas_webhook_logs_processed ON public.asaas_webhook_logs USING btree (processed) WHERE (processed = false)
  ```

---

### service_orders

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `os_number` | `integer` | Não | `nextval('service_orders_os_number_seq'::regclass)` | ✨ Unique |
| `equipment_id` | `uuid` | Sim | - |  |
| `equipment_asset_number` | `text` | Sim | - |  |
| `equipment_name` | `text` | Sim | - |  |
| `equipment_model` | `text` | Sim | - |  |
| `equipment_serial_number` | `text` | Sim | - |  |
| `equipment_condition_entry` | `text` | Sim | - |  |
| `executed_by` | `uuid` | Sim | - |  |
| `execution_date` | `date` | Sim | - |  |
| `execution_location` | `text` | Sim | - |  |
| `status` | `USER-DEFINED` | Sim | `'Aberta'::service_order_status_type` | Valores: ["Aberta", "Em Andamento", "Aguardando Peças", "Concluída", "Cancelada"] |
| `description` | `text` | Sim | - |  |
| `notes` | `text` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Sim | `now()` |  |
| `updated_at` | `timestamp with time zone` | Sim | `now()` |  |
| `order_type` | `text` | Não | `'Interna'::text` |  |
| `hour_meter_before` | `numeric` | Sim | - |  |
| `hour_meter_after` | `numeric` | Sim | - |  |
| `client_name` | `text` | Sim | - |  |
| `client_address` | `text` | Sim | - |  |
| `client_contact_name` | `text` | Sim | - |  |
| `client_phone` | `text` | Sim | - |  |
| `client_request` | `text` | Sim | - |  |
| `diagnosis` | `text` | Sim | - |  |
| `services_executed` | `text` | Sim | - |  |
| `tech_observation` | `text` | Sim | - |  |
| `tech_observation_ok` | `boolean` | Sim | - |  |
| `equipment_functional` | `boolean` | Sim | - |  |
| `client_observation` | `text` | Sim | - |  |
| `client_observation_ok` | `boolean` | Sim | - |  |
| `checklist_equipment_conditions` | `boolean` | Sim | - |  |
| `checklist_safe_work` | `boolean` | Sim | - |  |
| `checklist_epi` | `boolean` | Sim | - |  |
| `checklist_adequate_environment` | `boolean` | Sim | - |  |
| `checklist_well_served` | `boolean` | Sim | - |  |
| `vehicle_plate` | `text` | Sim | - |  |
| `vehicle_km_start` | `numeric` | Sim | - |  |
| `vehicle_km_end` | `numeric` | Sim | - |  |
| `signer_client_name` | `text` | Sim | - |  |
| `signer_client_rg` | `text` | Sim | - |  |
| `signer_client_role` | `text` | Sim | - |  |
| `signer_tech_name` | `text` | Sim | - |  |
| `signer_tech_role` | `text` | Sim | - |  |
| `parts_pending` | `boolean` | Sim | - |  |
| `critical_analysis` | `text` | Sim | - |  |
| `cost_company` | `numeric` | Sim | `0` |  |
| `cost_client` | `numeric` | Sim | `0` |  |
| `has_pending` | `boolean` | Sim | `false` |  |
| `nfe_invoices` | `jsonb` | Sim | `'[]'::jsonb` | Lista de NF-es vinculadas à OS (acesso, número, emitente, data, valor) |
| `nfe_access_keys` | `text[]` | Sim | `'{}'::text[]` | Array de chaves de acesso das NF-es vinculadas |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`service_order_parts.service_order_id`](#service-order-parts)`(service_order_id)` aponta para a coluna local `id` (Constraint: `service_order_parts_service_order_id_fkey`)
* [`service_order_labor.service_order_id`](#service-order-labor)`(service_order_id)` aponta para a coluna local `id` (Constraint: `service_order_labor_service_order_id_fkey`)

#### Índices (Indexes)

* **`service_orders_os_number_key`**
  ```sql
  CREATE UNIQUE INDEX service_orders_os_number_key ON public.service_orders USING btree (os_number)
  ```

#### Gatilhos (Triggers)

* **`update_service_orders_updated_at`**
  ```sql
  CREATE TRIGGER update_service_orders_updated_at BEFORE UPDATE ON public.service_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  ```

---

### service_order_parts

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `service_order_id` | `uuid` | Sim | - |  |
| `part_id` | `uuid` | Sim | - |  |
| `quantity_used` | `integer` | Sim | `1` |  |
| `unit_value_at_use` | `numeric` | Sim | `0` |  |
| `subtotal` | `numeric` | Sim | `0` |  |
| `was_used` | `boolean` | Sim | `true` |  |

---

### invoice_year_counters

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `year` | `integer` | Não | - | 🔑 PK |
| `last_seq` | `integer` | Não | `0` |  |

---

### hr_job_levels

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK; Identificador único |
| `name` | `text` | Não | - | Nome do nível (ex: "Júnior", "Pleno", "Sênior") |
| `description` | `text` | Sim | - | Descrição do nível |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`hr_employee_positions.level_id`](#hr-employee-positions)`(level_id)` aponta para a coluna local `id` (Constraint: `hr_employee_positions_level_id_fkey`)
* [`hr_salary_ranges.level_id`](#hr-salary-ranges)`(level_id)` aponta para a coluna local `id` (Constraint: `hr_salary_ranges_level_id_fkey`)

---

### hr_positions

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK; Identificador único |
| `title` | `text` | Não | - | Título do cargo (ex: "Técnico de Manutenção") |
| `department` | `text` | Não | - | Departamento (ex: "Operações", "Comercial", "Administrativo") |
| `description` | `text` | Sim | - | Descrição e responsabilidades do cargo |
| `cbo_code` | `text` | Sim | - | Código Brasileiro de Ocupações (CBO) |
| `active` | `boolean` | Não | `true` | Cargo ativo ou desativado |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`hr_salary_ranges.position_id`](#hr-salary-ranges)`(position_id)` aponta para a coluna local `id` (Constraint: `hr_salary_ranges_position_id_fkey`)
* [`hr_employee_positions.position_id`](#hr-employee-positions)`(position_id)` aponta para a coluna local `id` (Constraint: `hr_employee_positions_position_id_fkey`)
* [`hr_position_document_types.position_id`](#hr-position-document-types)`(position_id)` aponta para a coluna local `id` (Constraint: `hr_position_document_types_position_id_fkey`)

---

### hr_salary_ranges

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK; Identificador único |
| `position_id` | `uuid` | Não | - | Cargo ao qual a faixa pertence |
| `level_id` | `uuid` | Não | - | Nível hierárquico da faixa |
| `salary_min` | `numeric` | Não | - | Piso salarial da faixa |
| `salary_mid` | `numeric` | Sim | - | Ponto médio (midpoint) da faixa |
| `salary_max` | `numeric` | Não | - | Teto salarial da faixa |
| `effective_date` | `date` | Não | - | Data de vigência desta faixa |
| `notes` | `text` | Sim | - | Observações (ex: "Revisão anual 2025") |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

---

### hr_employee_positions

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK; Identificador único |
| `user_id` | `uuid` | Não | - | Colaborador |
| `position_id` | `uuid` | Não | - | Cargo assumido |
| `level_id` | `uuid` | Não | - | Nível assumido |
| `salary` | `numeric` | Não | - | Salário negociado nesta vigência |
| `start_date` | `date` | Não | - | Início da vigência |
| `end_date` | `date` | Sim | - | Fim da vigência (NULL = posição atual) |
| `change_reason` | `text` | Sim | - | Motivo da movimentação (promoção, reajuste, transferência, etc.) |
| `registered_by` | `uuid` | Sim | - | Quem registrou a movimentação |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`idx_employee_positions_current`**
  ```sql
  CREATE INDEX idx_employee_positions_current ON public.hr_employee_positions USING btree (user_id) WHERE (end_date IS NULL)
  ```
* **`idx_employee_positions_user`**
  ```sql
  CREATE INDEX idx_employee_positions_user ON public.hr_employee_positions USING btree (user_id)
  ```

---

### hr_document_types

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK; Identificador único |
| `name` | `text` | Não | - | ✨ Unique; Nome do documento (ex: "CNH", "ASO", "CTPS") |
| `description` | `text` | Sim | - | Descrição e instruções |
| `requires_expiry` | `boolean` | Não | `false` | Se o documento possui data de validade |
| `alert_days_before` | `integer` | Sim | `30` | Quantos dias antes do vencimento emitir alerta |
| `mandatory` | `boolean` | Não | `true` | Se é obrigatório para todos os colaboradores |
| `active` | `boolean` | Não | `true` | Tipo ativo no sistema |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`hr_position_document_types.document_type_id`](#hr-position-document-types)`(document_type_id)` aponta para a coluna local `id` (Constraint: `hr_position_document_types_document_type_id_fkey`)
* [`hr_employee_documents.document_type_id`](#hr-employee-documents)`(document_type_id)` aponta para a coluna local `id` (Constraint: `hr_employee_documents_document_type_id_fkey`)

#### Índices (Indexes)

* **`hr_document_types_name_key`**
  ```sql
  CREATE UNIQUE INDEX hr_document_types_name_key ON public.hr_document_types USING btree (name)
  ```

---

### hr_employee_documents

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK; Identificador único |
| `user_id` | `uuid` | Não | - | Colaborador titular |
| `document_type_id` | `uuid` | Não | - | Tipo do documento |
| `document_number` | `text` | Sim | - | Número/identificador do documento |
| `issue_date` | `date` | Sim | - | Data de emissão |
| `expiry_date` | `date` | Sim | - | Data de validade (obrigatório se requires_expiry = TRUE) |
| `status` | `text` | Não | `'Válido'::text` | Status: Válido, Vencido, A Vencer, Pendente, Dispensado |
| `file_url` | `text` | Sim | - | URL do arquivo no Supabase Storage |
| `notes` | `text` | Sim | - | Observações |
| `registered_by` | `uuid` | Sim | - | Quem registrou |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`idx_employee_documents_expiry`**
  ```sql
  CREATE INDEX idx_employee_documents_expiry ON public.hr_employee_documents USING btree (expiry_date) WHERE (expiry_date IS NOT NULL)
  ```
* **`idx_employee_documents_status`**
  ```sql
  CREATE INDEX idx_employee_documents_status ON public.hr_employee_documents USING btree (status)
  ```
* **`idx_employee_documents_user`**
  ```sql
  CREATE INDEX idx_employee_documents_user ON public.hr_employee_documents USING btree (user_id)
  ```

---

### hr_integration_types

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK; Identificador único |
| `name` | `text` | Não | - | ✨ Unique; Nome da integração (ex: "Integração SST Cliente X", "NR-35 Trabalho em Altura") |
| `description` | `text` | Sim | - | Descrição e requisitos |
| `validity_days` | `integer` | Sim | - | Validade padrão em dias (pode ser sobrescrita por registro) |
| `alert_days_before` | `integer` | Não | `15` | Dias de antecedência para alertas de vencimento |
| `active` | `boolean` | Não | `true` | Tipo ativo |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`hr_employee_integrations.integration_type_id`](#hr-employee-integrations)`(integration_type_id)` aponta para a coluna local `id` (Constraint: `hr_employee_integrations_integration_type_id_fkey`)

#### Índices (Indexes)

* **`hr_integration_types_name_key`**
  ```sql
  CREATE UNIQUE INDEX hr_integration_types_name_key ON public.hr_integration_types USING btree (name)
  ```

---

### hr_employee_integrations

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK; Identificador único |
| `user_id` | `uuid` | Não | - | Colaborador |
| `integration_type_id` | `uuid` | Não | - | Tipo de integração |
| `client_id` | `uuid` | Sim | - | Cliente/empresa onde a integração foi realizada (opcional) |
| `integration_date` | `date` | Não | - | Data em que a integração foi realizada |
| `expiry_date` | `date` | Sim | - | Data de vencimento da integração |
| `status` | `text` | Não | `'Válida'::text` | Status: Válida, Vencida, A Vencer, Cancelada |
| `location` | `text` | Sim | - | Local onde foi realizada (obra, unidade, endereço) |
| `notes` | `text` | Sim | - | Observações adicionais |
| `file_url` | `text` | Sim | - | Comprovante/certificado no Supabase Storage |
| `registered_by` | `uuid` | Sim | - | Quem registrou |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`idx_employee_integrations_expiry`**
  ```sql
  CREATE INDEX idx_employee_integrations_expiry ON public.hr_employee_integrations USING btree (expiry_date) WHERE (expiry_date IS NOT NULL)
  ```
* **`idx_employee_integrations_status`**
  ```sql
  CREATE INDEX idx_employee_integrations_status ON public.hr_employee_integrations USING btree (status)
  ```
* **`idx_employee_integrations_user`**
  ```sql
  CREATE INDEX idx_employee_integrations_user ON public.hr_employee_integrations USING btree (user_id)
  ```

---

### hr_training_catalog

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK; Identificador único |
| `name` | `text` | Não | - | Nome do treinamento (ex: "NR-11 Operação de Plataformas") |
| `category` | `text` | Sim | - | Categoria (ex: "Segurança", "Operação", "Gestão", "Qualidade") |
| `description` | `text` | Sim | - | Descrição e objetivos do treinamento |
| `workload_hours` | `numeric` | Sim | - | Carga horária padrão |
| `validity_days` | `integer` | Sim | - | Validade padrão em dias (0 ou NULL = sem validade) |
| `alert_days_before` | `integer` | Não | `30` | Dias de antecedência para alertas de renovação |
| `mandatory` | `boolean` | Não | `false` | Se é obrigatório para todos os colaboradores |
| `active` | `boolean` | Não | `true` | Treinamento ativo no catálogo |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`hr_employee_trainings.training_id`](#hr-employee-trainings)`(training_id)` aponta para a coluna local `id` (Constraint: `hr_employee_trainings_training_id_fkey`)

---

### hr_employee_trainings

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK; Identificador único |
| `user_id` | `uuid` | Não | - | Colaborador que realizou o treinamento |
| `training_id` | `uuid` | Não | - | Treinamento do catálogo |
| `provider` | `text` | Sim | - | Instituição/empresa fornecedora do treinamento |
| `instructor` | `text` | Sim | - | Nome do instrutor (quando aplicável) |
| `completion_date` | `date` | Não | - | Data de conclusão do treinamento |
| `workload_hours` | `numeric` | Sim | - | Carga horária efetiva (pode diferir do padrão) |
| `expiry_date` | `date` | Sim | - | Data de validade do certificado (quando aplicável) |
| `status` | `text` | Não | `'Válido'::text` | Status: Válido, Vencido, A Vencer |
| `certificate_url` | `text` | Sim | - | Certificado no Supabase Storage |
| `cost` | `numeric` | Sim | - | Custo do treinamento (para controle de investimento em T&D) |
| `notes` | `text` | Sim | - | Observações |
| `registered_by` | `uuid` | Sim | - | Quem lançou o registro |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`idx_employee_trainings_expiry`**
  ```sql
  CREATE INDEX idx_employee_trainings_expiry ON public.hr_employee_trainings USING btree (expiry_date) WHERE (expiry_date IS NOT NULL)
  ```
* **`idx_employee_trainings_status`**
  ```sql
  CREATE INDEX idx_employee_trainings_status ON public.hr_employee_trainings USING btree (status)
  ```
* **`idx_employee_trainings_user`**
  ```sql
  CREATE INDEX idx_employee_trainings_user ON public.hr_employee_trainings USING btree (user_id)
  ```

---

### crm_leads

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `company_name` | `text` | Não | - |  |
| `cnpj` | `text` | Sim | - |  |
| `segment` | `text` | Sim | - |  |
| `estimated_potential` | `numeric` | Sim | - |  |
| `source` | `text` | Sim | - |  |
| `status` | `text` | Não | `'Novo'::text` |  |
| `converted_at` | `timestamp with time zone` | Sim | - |  |
| `converted_client_id` | `uuid` | Sim | - |  |
| `owner_id` | `uuid` | Não | - |  |
| `notes` | `text` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`crm_tasks.lead_id`](#crm-tasks)`(lead_id)` aponta para a coluna local `id` (Constraint: `crm_tasks_lead_id_fkey`)
* [`crm_deals.lead_id`](#crm-deals)`(lead_id)` aponta para a coluna local `id` (Constraint: `crm_deals_lead_id_fkey`)
* [`crm_contacts.lead_id`](#crm-contacts)`(lead_id)` aponta para a coluna local `id` (Constraint: `crm_contacts_lead_id_fkey`)

#### Índices (Indexes)

* **`idx_crm_leads_converted`**
  ```sql
  CREATE INDEX idx_crm_leads_converted ON public.crm_leads USING btree (converted_client_id) WHERE (converted_client_id IS NOT NULL)
  ```
* **`idx_crm_leads_owner`**
  ```sql
  CREATE INDEX idx_crm_leads_owner ON public.crm_leads USING btree (owner_id)
  ```
* **`idx_crm_leads_status`**
  ```sql
  CREATE INDEX idx_crm_leads_status ON public.crm_leads USING btree (status)
  ```

---

### crm_contacts

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `lead_id` | `uuid` | Sim | - |  |
| `client_id` | `uuid` | Sim | - |  |
| `full_name` | `text` | Não | - |  |
| `role_title` | `text` | Sim | - |  |
| `department` | `text` | Sim | - |  |
| `email` | `text` | Sim | - |  |
| `phone` | `text` | Sim | - |  |
| `is_primary` | `boolean` | Não | `false` |  |
| `notes` | `text` | Sim | - |  |
| `active` | `boolean` | Não | `true` |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`crm_tasks.contact_id`](#crm-tasks)`(contact_id)` aponta para a coluna local `id` (Constraint: `crm_tasks_contact_id_fkey`)
* [`crm_deal_activities.contact_id`](#crm-deal-activities)`(contact_id)` aponta para a coluna local `id` (Constraint: `crm_deal_activities_contact_id_fkey`)
* [`crm_deals.primary_contact_id`](#crm-deals)`(primary_contact_id)` aponta para a coluna local `id` (Constraint: `crm_deals_primary_contact_id_fkey`)

#### Índices (Indexes)

* **`idx_crm_contacts_client`**
  ```sql
  CREATE INDEX idx_crm_contacts_client ON public.crm_contacts USING btree (client_id) WHERE (client_id IS NOT NULL)
  ```
* **`idx_crm_contacts_lead`**
  ```sql
  CREATE INDEX idx_crm_contacts_lead ON public.crm_contacts USING btree (lead_id) WHERE (lead_id IS NOT NULL)
  ```

---

### crm_pipelines

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `name` | `text` | Não | - | ✨ Unique |
| `description` | `text` | Sim | - |  |
| `active` | `boolean` | Não | `true` |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`crm_deals.pipeline_id`](#crm-deals)`(pipeline_id)` aponta para a coluna local `id` (Constraint: `crm_deals_pipeline_id_fkey`)
* [`crm_pipeline_stages.pipeline_id`](#crm-pipeline-stages)`(pipeline_id)` aponta para a coluna local `id` (Constraint: `crm_pipeline_stages_pipeline_id_fkey`)

#### Índices (Indexes)

* **`crm_pipelines_name_key`**
  ```sql
  CREATE UNIQUE INDEX crm_pipelines_name_key ON public.crm_pipelines USING btree (name)
  ```

---

### crm_pipeline_stages

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `pipeline_id` | `uuid` | Não | - |  |
| `name` | `text` | Não | - |  |
| `position` | `integer` | Não | - |  |
| `is_won` | `boolean` | Não | `false` |  |
| `is_lost` | `boolean` | Não | `false` |  |
| `probability_pct` | `integer` | Sim | - | CHECK: probability_pct >= 0 AND probability_pct <= 100 |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`crm_deal_activities.stage_to_id`](#crm-deal-activities)`(stage_to_id)` aponta para a coluna local `id` (Constraint: `crm_deal_activities_stage_to_id_fkey`)
* [`crm_deals.stage_id`](#crm-deals)`(stage_id)` aponta para a coluna local `id` (Constraint: `crm_deals_stage_id_fkey`)
* [`crm_deal_activities.stage_from_id`](#crm-deal-activities)`(stage_from_id)` aponta para a coluna local `id` (Constraint: `crm_deal_activities_stage_from_id_fkey`)

#### Índices (Indexes)

* **`idx_crm_stages_pipeline`**
  ```sql
  CREATE INDEX idx_crm_stages_pipeline ON public.crm_pipeline_stages USING btree (pipeline_id)
  ```

---

### crm_deals

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `title` | `text` | Não | - |  |
| `pipeline_id` | `uuid` | Não | - |  |
| `stage_id` | `uuid` | Não | - |  |
| `lead_id` | `uuid` | Sim | - |  |
| `client_id` | `uuid` | Sim | - |  |
| `primary_contact_id` | `uuid` | Sim | - |  |
| `owner_id` | `uuid` | Não | - |  |
| `value` | `numeric` | Sim | - |  |
| `probability_pct` | `integer` | Sim | - | CHECK: probability_pct >= 0 AND probability_pct <= 100 |
| `expected_close_date` | `date` | Sim | - |  |
| `closed_at` | `timestamp with time zone` | Sim | - |  |
| `lost_reason` | `text` | Sim | - |  |
| `description` | `text` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |
| `active_contract_id` | `uuid` | Sim | - |  |
| `contract_form_id` | `uuid` | Sim | - |  |
| `rental_invoice_id` | `uuid` | Sim | - | Chave estrangeira para fatura de locação vinculada |

#### Relacionamentos de Saída (Chaves Estrangeiras Referenciadas)

* A coluna `active_contract_id` aponta para [`crm_deal_contracts.id`](#crm-deal-contracts)`(id)` (Constraint: `crm_deals_active_contract_id_fkey`)
* A coluna `contract_form_id` aponta para [`crm_deal_contract_forms.id`](#crm-deal-contract-forms)`(id)` (Constraint: `crm_deals_contract_form_id_fkey`)
* A coluna `rental_invoice_id` aponta para [`rental_invoices.id`](#rental-invoices)`(id)` (Constraint: `crm_deals_rental_invoice_id_fkey`)
* A coluna `pipeline_id` aponta para [`crm_pipelines.id`](#crm-pipelines)`(id)` (Constraint: `crm_deals_pipeline_id_fkey`)
* A coluna `stage_id` aponta para [`crm_pipeline_stages.id`](#crm-pipeline-stages)`(id)` (Constraint: `crm_deals_stage_id_fkey`)
* A coluna `client_id` aponta para [`clients.id`](#clients)`(id)` (Constraint: `crm_deals_client_id_fkey`)
* A coluna `lead_id` aponta para [`crm_leads.id`](#crm-leads)`(id)` (Constraint: `crm_deals_lead_id_fkey`)
* A coluna `primary_contact_id` aponta para [`crm_contacts.id`](#crm-contacts)`(id)` (Constraint: `crm_deals_primary_contact_id_fkey`)
* A coluna `owner_id` aponta para [`users_profiles.id`](#users-profiles)`(id)` (Constraint: `crm_deals_owner_id_fkey`)

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`crm_tasks.deal_id`](#crm-tasks)`(deal_id)` aponta para a coluna local `id` (Constraint: `crm_tasks_deal_id_fkey`)
* [`crm_deal_activities.deal_id`](#crm-deal-activities)`(deal_id)` aponta para a coluna local `id` (Constraint: `crm_deal_activities_deal_id_fkey`)
* [`crm_deal_contract_forms.deal_id`](#crm-deal-contract-forms)`(deal_id)` aponta para a coluna local `id` (Constraint: `crm_deal_contract_forms_deal_id_fkey`)
* [`crm_deal_contracts.deal_id`](#crm-deal-contracts)`(deal_id)` aponta para a coluna local `id` (Constraint: `crm_deal_contracts_deal_id_fkey`)
* [`rental_invoices.deal_id`](#rental-invoices)`(deal_id)` aponta para a coluna local `id` (Constraint: `rental_invoices_deal_id_fkey`)

#### Índices (Indexes)

* **`idx_crm_deals_client`**
  ```sql
  CREATE INDEX idx_crm_deals_client ON public.crm_deals USING btree (client_id) WHERE (client_id IS NOT NULL)
  ```
* **`idx_crm_deals_close_date`**
  ```sql
  CREATE INDEX idx_crm_deals_close_date ON public.crm_deals USING btree (expected_close_date)
  ```
* **`idx_crm_deals_lead`**
  ```sql
  CREATE INDEX idx_crm_deals_lead ON public.crm_deals USING btree (lead_id) WHERE (lead_id IS NOT NULL)
  ```
* **`idx_crm_deals_owner`**
  ```sql
  CREATE INDEX idx_crm_deals_owner ON public.crm_deals USING btree (owner_id)
  ```
* **`idx_crm_deals_pipeline`**
  ```sql
  CREATE INDEX idx_crm_deals_pipeline ON public.crm_deals USING btree (pipeline_id)
  ```
* **`idx_crm_deals_stage`**
  ```sql
  CREATE INDEX idx_crm_deals_stage ON public.crm_deals USING btree (stage_id)
  ```

---

### crm_deal_activities

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `deal_id` | `uuid` | Não | - |  |
| `activity_type` | `text` | Não | - |  |
| `description` | `text` | Não | - |  |
| `stage_from_id` | `uuid` | Sim | - |  |
| `stage_to_id` | `uuid` | Sim | - |  |
| `contact_id` | `uuid` | Sim | - |  |
| `performed_by` | `uuid` | Não | - |  |
| `activity_date` | `timestamp with time zone` | Não | `now()` |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`idx_crm_activities_date`**
  ```sql
  CREATE INDEX idx_crm_activities_date ON public.crm_deal_activities USING btree (activity_date)
  ```
* **`idx_crm_activities_deal`**
  ```sql
  CREATE INDEX idx_crm_activities_deal ON public.crm_deal_activities USING btree (deal_id)
  ```

---

### crm_task_types

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `name` | `text` | Não | - | ✨ Unique |
| `active` | `boolean` | Não | `true` |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`crm_tasks.task_type_id`](#crm-tasks)`(task_type_id)` aponta para a coluna local `id` (Constraint: `crm_tasks_task_type_id_fkey`)

#### Índices (Indexes)

* **`crm_task_types_name_key`**
  ```sql
  CREATE UNIQUE INDEX crm_task_types_name_key ON public.crm_task_types USING btree (name)
  ```

---

### crm_tasks

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `task_type_id` | `uuid` | Não | - |  |
| `title` | `text` | Não | - |  |
| `description` | `text` | Sim | - |  |
| `deal_id` | `uuid` | Sim | - |  |
| `lead_id` | `uuid` | Sim | - |  |
| `contact_id` | `uuid` | Sim | - |  |
| `assigned_to` | `uuid` | Não | - |  |
| `created_by` | `uuid` | Não | - |  |
| `due_date` | `timestamp with time zone` | Não | - |  |
| `completed_at` | `timestamp with time zone` | Sim | - |  |
| `status` | `text` | Não | `'Pendente'::text` |  |
| `priority` | `text` | Não | `'Normal'::text` |  |
| `notes` | `text` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`idx_crm_tasks_assigned`**
  ```sql
  CREATE INDEX idx_crm_tasks_assigned ON public.crm_tasks USING btree (assigned_to)
  ```
* **`idx_crm_tasks_deal`**
  ```sql
  CREATE INDEX idx_crm_tasks_deal ON public.crm_tasks USING btree (deal_id) WHERE (deal_id IS NOT NULL)
  ```
* **`idx_crm_tasks_due`**
  ```sql
  CREATE INDEX idx_crm_tasks_due ON public.crm_tasks USING btree (due_date)
  ```
* **`idx_crm_tasks_lead`**
  ```sql
  CREATE INDEX idx_crm_tasks_lead ON public.crm_tasks USING btree (lead_id) WHERE (lead_id IS NOT NULL)
  ```
* **`idx_crm_tasks_status`**
  ```sql
  CREATE INDEX idx_crm_tasks_status ON public.crm_tasks USING btree (status)
  ```

---

### erp_company_settings

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)
* **Nota Arquitetural:** Configurações centrais da locadora (single-tenant), dados bancários para repasse, chaves de API e credenciais de faturamento.

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `company_name` | `text` | Não | - |  |
| `cnpj` | `text` | Não | - |  |
| `state_registration` | `text` | Sim | - |  |
| `address_full` | `text` | Não | - |  |
| `logo_url` | `text` | Sim | - |  |
| `bank_name` | `text` | Sim | - |  |
| `bank_code` | `text` | Sim | - |  |
| `bank_agency` | `text` | Sim | - |  |
| `bank_account` | `text` | Sim | - |  |
| `bank_pix_key` | `text` | Sim | - |  |
| `contract_clauses` | `jsonb` | Não | - |  |
| `active` | `boolean` | Não | `true` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |
| `asaas_account_id` | `text` | Sim | - | ID da subconta criada via API no Asaas (ex: acct_0001) |
| `asaas_api_key` | `text` | Sim | - | Chave de API exclusiva desta subconta, usada para emitir boletos |
| `asaas_boleto_fee_amount` | `numeric` | Sim | - |  |
| `asaas_pix_fee_percent` | `numeric` | Sim | - |  |
| `nfse_service_code` | `text` | Sim | - |  |
| `nfse_iss_regime` | `text` | Não | `'Isento'::text` |  |

---

### crm_deal_contract_forms

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `deal_id` | `uuid` | Não | - | ✨ Unique |
| `contract_date` | `date` | Não | - |  |
| `locatario_company_name` | `text` | Não | - |  |
| `locatario_cnpj` | `text` | Não | - |  |
| `locatario_state_registration` | `text` | Sim | - |  |
| `locatario_address_full` | `text` | Não | - |  |
| `equipment_description` | `text` | Não | - |  |
| `equipment_model` | `text` | Não | - |  |
| `contract_duration_days` | `integer` | Não | - |  |
| `period_start` | `date` | Sim | - |  |
| `period_end` | `date` | Sim | - |  |
| `cost_rental` | `numeric` | Não | `0` |  |
| `cost_insurance` | `numeric` | Não | `0` |  |
| `cost_freight` | `numeric` | Não | `0` |  |
| `cost_rcd` | `numeric` | Não | `0` |  |
| `cost_third_party` | `numeric` | Não | `0` |  |
| `cost_training` | `numeric` | Não | `0` |  |
| `cost_total` | `numeric` | Não | - |  |
| `billing_interval_days` | `text` | Sim | - | Condições de Pagamento (ex: '7 dias', '15 dias', '28 dias', 'A vista') |  |
| `work_site` | `text` | Não | - |  |
| `site_contact_name` | `text` | Sim | - |  |
| `site_contact_phone` | `text` | Sim | - |  |
| `notes` | `text` | Sim | - |  |
| `form_status` | `text` | Não | `'Rascunho'::text` |  |
| `created_by` | `uuid` | Não | - |  |
| `updated_by` | `uuid` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`crm_deals.contract_form_id`](#crm-deals)`(contract_form_id)` aponta para a coluna local `id` (Constraint: `crm_deals_contract_form_id_fkey`)
* [`crm_deal_contracts.contract_form_id`](#crm-deal-contracts)`(contract_form_id)` aponta para a coluna local `id` (Constraint: `crm_deal_contracts_contract_form_id_fkey`)

#### Índices (Indexes)

* **`idx_deal_contract_forms_deal`**
  ```sql
  CREATE INDEX idx_deal_contract_forms_deal ON public.crm_deal_contract_forms USING btree (deal_id)
  ```
* **`idx_deal_contract_forms_status`**
  ```sql
  CREATE INDEX idx_deal_contract_forms_status ON public.crm_deal_contract_forms USING btree (form_status)
  ```

---

### crm_deal_contracts

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `deal_id` | `uuid` | Não | - |  |
| `contract_form_id` | `uuid` | Não | - |  |
| `contract_number` | `text` | Não | - | ✨ Unique |
| `version` | `integer` | Não | `1` |  |
| `status` | `text` | Não | `'Gerado'::text` |  |
| `generated_at` | `timestamp with time zone` | Não | `now()` |  |
| `generated_by` | `uuid` | Não | - |  |
| `signed_file_url` | `text` | Sim | - |  |
| `signed_uploaded_at` | `timestamp with time zone` | Sim | - |  |
| `signed_uploaded_by` | `uuid` | Sim | - |  |
| `snapshot` | `jsonb` | Não | - |  |
| `notes` | `text` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |
| `rental_invoice_id` | `uuid` | Sim | - |  |
| `pdf_url` | `text` | Sim | - |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`crm_deals.active_contract_id`](#crm-deals)`(active_contract_id)` aponta para a coluna local `id` (Constraint: `crm_deals_active_contract_id_fkey`)
* [`logistics_triage_photos.contract_id`](#logistics-triage-photos)`(contract_id)` aponta para a coluna local `id` (Constraint: `logistics_triage_photos_contract_id_fkey`)

#### Índices (Indexes)

* **`crm_deal_contracts_contract_number_key`**
  ```sql
  CREATE UNIQUE INDEX crm_deal_contracts_contract_number_key ON public.crm_deal_contracts USING btree (contract_number)
  ```
* **`idx_deal_contracts_deal`**
  ```sql
  CREATE INDEX idx_deal_contracts_deal ON public.crm_deal_contracts USING btree (deal_id)
  ```
* **`idx_deal_contracts_form`**
  ```sql
  CREATE INDEX idx_deal_contracts_form ON public.crm_deal_contracts USING btree (contract_form_id)
  ```
* **`idx_deal_contracts_number`**
  ```sql
  CREATE INDEX idx_deal_contracts_number ON public.crm_deal_contracts USING btree (contract_number)
  ```
* **`idx_deal_contracts_status`**
  ```sql
  CREATE INDEX idx_deal_contracts_status ON public.crm_deal_contracts USING btree (status)
  ```

---

### logistics_triage_photos

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `contract_id` | `uuid` | Não | - |  |
| `position` | `integer` | Não | - |  |
| `label` | `text` | Não | - |  |
| `file_path` | `text` | Não | - |  |
| `file_url` | `text` | Sim | - |  |
| `uploaded_by` | `uuid` | Sim | - |  |
| `uploaded_at` | `timestamp with time zone` | Sim | `now()` |  |

#### Índices (Indexes)

* **`logistics_triage_photos_contract_id_position_key`**
  ```sql
  CREATE UNIQUE INDEX logistics_triage_photos_contract_id_position_key ON public.logistics_triage_photos USING btree (contract_id, "position")
  ```

---

### hr_epi_catalog

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `name` | `text` | Não | - | ✨ Unique |
| `ca_number` | `text` | Sim | - |  |
| `description` | `text` | Sim | - |  |
| `active` | `boolean` | Não | `true` |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`hr_epi_record_items.epi_id`](#hr-epi-record-items)`(epi_id)` aponta para a coluna local `id` (Constraint: `hr_epi_record_items_epi_id_fkey`)

#### Índices (Indexes)

* **`hr_epi_catalog_name_key`**
  ```sql
  CREATE UNIQUE INDEX hr_epi_catalog_name_key ON public.hr_epi_catalog USING btree (name)
  ```

---

### hr_epi_record_items

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `epi_record_id` | `uuid` | Não | - |  |
| `epi_id` | `uuid` | Não | - |  |
| `quantity` | `integer` | Não | `1` |  |
| `notes` | `text` | Sim | - |  |

#### Índices (Indexes)

* **`idx_epi_record_items_epi`**
  ```sql
  CREATE INDEX idx_epi_record_items_epi ON public.hr_epi_record_items USING btree (epi_id)
  ```
* **`idx_epi_record_items_record`**
  ```sql
  CREATE INDEX idx_epi_record_items_record ON public.hr_epi_record_items USING btree (epi_record_id)
  ```
* **`uq_epi_in_record`**
  ```sql
  CREATE UNIQUE INDEX uq_epi_in_record ON public.hr_epi_record_items USING btree (epi_record_id, epi_id)
  ```

---

### hr_epi_records

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `user_id` | `uuid` | Não | - |  |
| `delivery_date` | `date` | Não | - |  |
| `file_url` | `text` | Não | - |  |
| `file_uploaded_at` | `timestamp with time zone` | Não | `now()` |  |
| `uploaded_by` | `uuid` | Não | - |  |
| `notes` | `text` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`hr_epi_record_items.epi_record_id`](#hr-epi-record-items)`(epi_record_id)` aponta para a coluna local `id` (Constraint: `hr_epi_record_items_epi_record_id_fkey`)

#### Índices (Indexes)

* **`idx_epi_records_date`**
  ```sql
  CREATE INDEX idx_epi_records_date ON public.hr_epi_records USING btree (delivery_date)
  ```
* **`idx_epi_records_user`**
  ```sql
  CREATE INDEX idx_epi_records_user ON public.hr_epi_records USING btree (user_id)
  ```

---

### hr_position_document_types

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `position_id` | `uuid` | Não | - |  |
| `document_type_id` | `uuid` | Não | - |  |
| `mandatory` | `boolean` | Não | `true` |  |
| `notes` | `text` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`idx_pos_doc_types_document`**
  ```sql
  CREATE INDEX idx_pos_doc_types_document ON public.hr_position_document_types USING btree (document_type_id)
  ```
* **`idx_pos_doc_types_position`**
  ```sql
  CREATE INDEX idx_pos_doc_types_position ON public.hr_position_document_types USING btree (position_id)
  ```

---

### hr_time_records

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `user_id` | `uuid` | Não | - |  |
| `record_type` | `text` | Não | - | CHECK: record_type = ANY (ARRAY['Entrada'::text, 'Saída Almoço'::text, 'Retorno Almoço'::text, 'Saída'::text]) |
| `recorded_at` | `timestamp with time zone` | Não | `now()` |  |
| `record_date` | `date` | Não | `CURRENT_DATE` |  |
| `origin` | `text` | Não | `'Sistema'::text` | CHECK: origin = ANY (ARRAY['Sistema'::text, 'Manual'::text]) |
| `justification` | `text` | Sim | - |  |
| `adjusted_by` | `uuid` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`idx_time_records_date`**
  ```sql
  CREATE INDEX idx_time_records_date ON public.hr_time_records USING btree (record_date)
  ```
* **`idx_time_records_user_date`**
  ```sql
  CREATE INDEX idx_time_records_user_date ON public.hr_time_records USING btree (user_id, record_date)
  ```

---

### hr_timesheet_reports

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `user_id` | `uuid` | Não | - |  |
| `period_start` | `date` | Não | - |  |
| `period_end` | `date` | Não | - |  |
| `total_days_worked` | `integer` | Não | `0` |  |
| `total_hours_worked` | `numeric` | Não | `0` |  |
| `total_overtime_hours` | `numeric` | Não | `0` |  |
| `total_absence_days` | `integer` | Não | `0` |  |
| `status` | `text` | Não | `'Gerada'::text` | CHECK: status = ANY (ARRAY['Gerada'::text, 'Aprovada'::text, 'Contestada'::text]) |
| `file_url` | `text` | Sim | - |  |
| `generated_by` | `uuid` | Não | - |  |
| `approved_by` | `uuid` | Sim | - |  |
| `approved_at` | `timestamp with time zone` | Sim | - |  |
| `notes` | `text` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`idx_timesheet_reports_period`**
  ```sql
  CREATE INDEX idx_timesheet_reports_period ON public.hr_timesheet_reports USING btree (period_start, period_end)
  ```
* **`idx_timesheet_reports_user`**
  ```sql
  CREATE INDEX idx_timesheet_reports_user ON public.hr_timesheet_reports USING btree (user_id)
  ```
* **`uq_timesheet_user_period`**
  ```sql
  CREATE UNIQUE INDEX uq_timesheet_user_period ON public.hr_timesheet_reports USING btree (user_id, period_start, period_end)
  ```

---

### hr_vacation_approvals

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `vacation_request_id` | `uuid` | Não | - |  |
| `approver_id` | `uuid` | Não | - |  |
| `status` | `text` | Não | `'Pendente'::text` | CHECK: status = ANY (ARRAY['Pendente'::text, 'Aprovado'::text, 'Rejeitado'::text]) |
| `rejection_reason` | `text` | Sim | - |  |
| `decided_at` | `timestamp with time zone` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`idx_vacation_approvals_appr`**
  ```sql
  CREATE INDEX idx_vacation_approvals_appr ON public.hr_vacation_approvals USING btree (approver_id)
  ```
* **`idx_vacation_approvals_req`**
  ```sql
  CREATE INDEX idx_vacation_approvals_req ON public.hr_vacation_approvals USING btree (vacation_request_id)
  ```
* **`idx_vacation_approvals_status`**
  ```sql
  CREATE INDEX idx_vacation_approvals_status ON public.hr_vacation_approvals USING btree (status)
  ```
* **`uq_approval_per_approver`**
  ```sql
  CREATE UNIQUE INDEX uq_approval_per_approver ON public.hr_vacation_approvals USING btree (vacation_request_id, approver_id)
  ```

#### Gatilhos (Triggers)

* **`trg_vacation_approval_status`**
  ```sql
  CREATE TRIGGER trg_vacation_approval_status AFTER INSERT OR UPDATE ON public.hr_vacation_approvals FOR EACH ROW EXECUTE FUNCTION fn_update_vacation_request_status()
  ```

---

### hr_vacation_installments

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `vacation_request_id` | `uuid` | Não | - |  |
| `installment_number` | `integer` | Não | - |  |
| `start_date` | `date` | Não | - |  |
| `end_date` | `date` | Não | - |  |
| `duration_days` | `integer` | Não | - | CHECK: duration_days >= 5 |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`idx_vacation_installments_req`**
  ```sql
  CREATE INDEX idx_vacation_installments_req ON public.hr_vacation_installments USING btree (vacation_request_id)
  ```
* **`uq_installment_number`**
  ```sql
  CREATE UNIQUE INDEX uq_installment_number ON public.hr_vacation_installments USING btree (vacation_request_id, installment_number)
  ```

---

### hr_vacation_requests

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `user_id` | `uuid` | Não | - |  |
| `entitlement_period_start` | `date` | Não | - |  |
| `entitlement_period_end` | `date` | Não | - |  |
| `total_entitled_days` | `integer` | Não | `30` |  |
| `installments_count` | `integer` | Não | - | CHECK: installments_count >= 1 AND installments_count <= 3 |
| `days_sold` | `integer` | Não | `0` | CHECK: days_sold >= 0 AND days_sold <= 10 |
| `total_days_requested` | `integer` | Não | - |  |
| `status` | `text` | Não | `'Pendente'::text` | CHECK: status = ANY (ARRAY['Pendente'::text, 'Em Aprovação'::text, 'Aprovada'::text, 'Rejeitada'::text, 'Cancelada'::text]) |
| `rejection_reason` | `text` | Sim | - |  |
| `notes` | `text` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Relacionamentos de Entrada (Tabelas que Referenciam esta)

* [`hr_vacation_approvals.vacation_request_id`](#hr-vacation-approvals)`(vacation_request_id)` aponta para a coluna local `id` (Constraint: `hr_vacation_approvals_vacation_request_id_fkey`)
* [`hr_vacation_installments.vacation_request_id`](#hr-vacation-installments)`(vacation_request_id)` aponta para a coluna local `id` (Constraint: `hr_vacation_installments_vacation_request_id_fkey`)

#### Índices (Indexes)

* **`idx_vacation_requests_status`**
  ```sql
  CREATE INDEX idx_vacation_requests_status ON public.hr_vacation_requests USING btree (status)
  ```
* **`idx_vacation_requests_user`**
  ```sql
  CREATE INDEX idx_vacation_requests_user ON public.hr_vacation_requests USING btree (user_id)
  ```

---

### service_order_labor

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `service_order_id` | `uuid` | Sim | - |  |
| `technician_name` | `text` | Não | - |  |
| `labor_date` | `date` | Sim | - |  |
| `start_time` | `time without time zone` | Sim | - |  |
| `end_time` | `time without time zone` | Sim | - |  |
| `labor_type` | `text` | Sim | `'T'::text` |  |
| `created_at` | `timestamp with time zone` | Sim | `now()` |  |

---

### invoice_nfse

* **Segurança de Nível de Linha (RLS):** Desabilitada (Disabled)

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `invoice_id` | `uuid` | Não | - |  |
| `gateway` | `text` | Não | `'asaas'::text` |  |
| `external_id` | `text` | Sim | - |  |
| `status` | `text` | Não | `'PENDENTE'::text` |  |
| `nfse_link` | `text` | Sim | - |  |
| `xml_url` | `text` | Sim | - |  |
| `service_code` | `text` | Sim | - |  |
| `iss_regime` | `text` | Sim | - |  |
| `return_message` | `text` | Sim | - |  |
| `created_at` | `timestamp with time zone` | Não | `now()` |  |
| `updated_at` | `timestamp with time zone` | Não | `now()` |  |

#### Índices (Indexes)

* **`invoice_nfse_invoice_id_idx`**
  ```sql
  CREATE INDEX invoice_nfse_invoice_id_idx ON public.invoice_nfse USING btree (invoice_id)
  ```

---

### stock_movements

* **Segurança de Nível de Linha (RLS):** Habilitada (Enabled)
* **Propósito:** Tabela de auditoria e rastreabilidade total de movimentações de estoque (entradas por importação de NF-e, saídas para aplicação em Ordens de Serviço, e ajustes manuais). Registra saldos anteriores e posteriores, responsável pela operação e timestamp.

#### Colunas

| Coluna | Tipo | Nulável | Padrão | Restrições / Notas |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | Não | `gen_random_uuid()` | 🔑 PK |
| `part_id` | `uuid` | Não | - | Foreign Key -> `parts.id` (ON DELETE CASCADE) |
| `movement_type` | `text` | Não | - | CHECK: movement_type IN ('ENTRADA', 'SAIDA', 'AJUSTE') |
| `quantity` | `numeric` | Não | - | Quantidade movimentada (positiva) |
| `unit_value` | `numeric` | Sim | `0` | Valor unitário na data da movimentação |
| `previous_stock` | `numeric` | Não | `0` | Saldo em estoque antes da movimentação |
| `new_stock` | `numeric` | Não | `0` | Saldo em estoque após a movimentação |
| `reference_type` | `text` | Não | - | CHECK: reference_type IN ('NFE_IMPORT', 'SERVICE_ORDER', 'MANUAL_ADJUSTMENT') |
| `reference_id` | `text` | Sim | - | Identificador de referência (Chave NF-e ou ID da OS) |
| `reference_label` | `text` | Sim | - | Rótulo legível (Ex: "NF-e 70804" ou "OS #1024") |
| `notes` | `text` | Sim | - | Descrição e observações da movimentação |
| `created_by` | `uuid` | Sim | - | Foreign Key -> `users_profiles.id` (Responsável) |
| `created_at` | `timestamp with time zone` | Não | `now()` | Data e hora exata da movimentação |

#### Índices (Indexes)

* **`idx_stock_movements_part_id`**
  ```sql
  CREATE INDEX idx_stock_movements_part_id ON public.stock_movements USING btree (part_id)
  ```
* **`idx_stock_movements_reference`**
  ```sql
  CREATE INDEX idx_stock_movements_reference ON public.stock_movements USING btree (reference_type, reference_id)
  ```
* **`idx_stock_movements_created_at`**
  ```sql
  CREATE INDEX idx_stock_movements_created_at ON public.stock_movements USING btree (created_at DESC)
  ```

---

## Definição das Funções Auxiliares

Estas funções PL/pgSQL são utilizadas por gatilhos ou como utilitários de segurança:

### Função `fn_update_vacation_request_status()`

```sql
CREATE OR REPLACE FUNCTION public.fn_update_vacation_request_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  req_id UUID := NEW.vacation_request_id;
  total_approvals INTEGER;
  approved_count INTEGER;
  rejected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_approvals
    FROM hr_vacation_approvals WHERE vacation_request_id = req_id;

  SELECT COUNT(*) INTO approved_count
    FROM hr_vacation_approvals WHERE vacation_request_id = req_id AND status = 'Aprovado';

  SELECT COUNT(*) INTO rejected_count
    FROM hr_vacation_approvals WHERE vacation_request_id = req_id AND status = 'Rejeitado';

  IF rejected_count > 0 THEN
    UPDATE hr_vacation_requests
      SET status = 'Rejeitada',
          rejection_reason = NEW.rejection_reason,
          updated_at = now()
      WHERE id = req_id;
  ELSIF approved_count = total_approvals THEN
    UPDATE hr_vacation_requests
      SET status = 'Aprovada', updated_at = now()
      WHERE id = req_id;
  ELSE
    UPDATE hr_vacation_requests
      SET status = 'Em Aprovação', updated_at = now()
      WHERE id = req_id;
  END IF;

  RETURN NEW;
END;
$function$
```

---

### Função `generate_invoice_number()`

```sql
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_year   INTEGER;
  v_seq    INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::INTEGER;

  -- Incrementa atomicamente o contador do ano corrente
  INSERT INTO public.invoice_year_counters (year, last_seq)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_seq = invoice_year_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  NEW.invoice_number := v_seq::TEXT || '/' || v_year::TEXT;
  RETURN NEW;
END;
$function$
```

---

### Função `get_next_contract_number()`

```sql
CREATE OR REPLACE FUNCTION public.get_next_contract_number()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(contract_number AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.crm_deal_contracts;
  RETURN LPAD(next_num::TEXT, 3, '0');
END;
$function$
```

---

### Função `is_hr_admin()`

```sql
CREATE OR REPLACE FUNCTION public.is_hr_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users_profiles
    WHERE id = auth.uid()
    AND access_level IN ('Administrador', 'Gerente', 'Diretoria', 'Recursos Humanos')
  );
END;
$function$
```

---

### Função `update_client_average_score()`

```sql
CREATE OR REPLACE FUNCTION public.update_client_average_score()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE clients
  SET average_score = (
    SELECT ROUND(AVG(client_score), 2)
    FROM rental_invoices
    WHERE client_id = NEW.client_id AND client_score IS NOT NULL
  )
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$function$
```

---

### Função `update_updated_at_column()`

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
```
