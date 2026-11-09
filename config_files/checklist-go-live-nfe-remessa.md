# Guia e Checklist de Go-Live: Emissão de NF-e de Remessa e Retorno em Produção

**Documento:** Checklist e Passo a Passo Operacional para Virada de Ambiente  
**Sistema:** RentDesk — C3Loc / Altomaster  
**Módulo:** Gestão Fiscal / Logística (NF-e Modelo 55 - Remessa de Bem do Ativo Imobilizado)  
**Ecossistema Fiscal:** Notaas API (`https://platform.notaas.com.br`) & SEFAZ-MT  
**Data:** 03/11/2026  
**Status:** Pronto para Execução do Go-Live  

---

## 1. Visão Geral da Funcionalidade

A funcionalidade desenvolvida contempla a automação completa do ciclo fiscal de transporte e locação de máquinas pesadas e plataformas elevatórias:
1. **Emissão de Remessa de Saída (Triagem):** Geração automática de NF-e (Modelo 55, CFOP 5554 Estadual / 6554 Interestadual, CSOSN 400 - Não Tributada pelo Simples Nacional) ao concluir o checklist de saída dos equipamentos na triagem.
2. **Emissão de Retorno de Locação (Devolução):** 
   - *Cliente Não Contribuinte / Isento:* Emissão automática de NF-e de entrada (CFOP 1554 / 2554) no retorno da máquina.
   - *Cliente Contribuinte (com IE ativa):* Registro e upload do DANFE/Chave emitido pelo próprio cliente.
3. **DANFE Clássico com Canhoto SEFAZ:** Renderização do PDF oficial idêntico ao modelo físico com canhoto destacável de recebimento, chave de 44 dígitos com código de barras Code 128 e armazenamento do XML oficial (`nfeProc`) e do PDF no Supabase Storage (`fiscal-documents`).

Toda a lógica e integração de código já foram **validadas e homologadas** no ambiente de testes da SEFAZ.

---

## 2. Checklist Pré-Go-Live (Pré-Requisitos Obrigatórios)

Preencha os itens abaixo antes de iniciar qualquer alteração no servidor de produção:

### 2.1. Fiscal e Contábil
- [X] **Credenciamento na SEFAZ-MT:** Confirmar com a contabilidade se a empresa está devidamente credenciada para emitir NF-e (Modelo 55) em **Ambiente de Produção**.
- [X] **Definição da Série da NF-e:**
  - [ ] **Opção A (Recomendada):** Criar uma **Série Nova Exclusiva** (ex.: `Série 2` ou `Série 3`), iniciando no número `1`. Isso isola completamente a emissão do C3Loc de qualquer outro sistema/ERP que a empresa utilize, eliminando riscos de colisão ou concorrência de numeração.
  - [X] **Opção B:** Continuar na série atual (ex.: `Série 1`). Neste caso, obter com a contabilidade o **último número de NF-e autorizado** para configurar o próximo consecutivo no Notaas.
- [X] **Certificado Digital A1:** Arquivo do Certificado Digital e-CNPJ (`.pfx` ou `.p12`) da empresa emitente com senha conhecida e data de validade ativa.
- [X] **Regime Tributário do Emitente:** Confirmar código de regime tributário no Notaas como **Simples Nacional** (CRT = 1).

### 2.2. Plataforma Notaas (`platform.notaas.com.br`)
- [X] **Projeto de Produção Criado/Configurado:** Acesso administrativo ao painel Notaas.
- [X] **Upload do Certificado Digital A1:** Certificado carregado e testado no projeto de Produção.
- [X] **Configuração da Numeração:** Série e próximo número de NF-e configurados no Notaas.
- [X] **Ambiente SEFAZ Definido:** Ambiente configurado como `1 - Produção` (não `2 - Homologação`).
- [X] **Geração da API Key de Produção:** Chave de API de Produção gerada (formato `ntaas_...`).
- [X] **Créditos Fiscais:** Saldo de créditos/plano ativo na Notaas para emissões em produção.

### 2.3. Infraestrutura e Sistema
- [X] **Bucket Supabase Storage:** Confirmar que o bucket `fiscal-documents` está criado no Supabase com permissões de upload e leitura pública.
- [X] **Tabela `rental_shipping_invoices`:** Tabela criada e com RLS permitindo inserção via `supabaseAdmin` e consulta por usuários autenticados.
- [X] **Acesso ao Servidor Backend:** Acesso para edição do arquivo `.env` de produção e reinicialização do serviço Node.js.

---

## 3. Passo a Passo de Execução da Virada (Go-Live)

### Etapa 1: Configuração no Painel Notaas

1. Acesse o painel: [https://platform.notaas.com.br](https://platform.notaas.com.br).
2. Selecione o projeto da empresa (**Altomaster / C3Loc**).
3. Vá em **Configurações > Certificado Digital**:
   - Faça o upload do arquivo do Certificado Digital A1 (`.pfx`).
   - Digite a senha do certificado e confirme. Verifique se o status ficou como **Válido / Ativo**.
4. Vá em **Configurações > Fiscal / Numeração**:
   - Alterne o ambiente para **Produção**.
   - Defina a **Série** (ex.: `2`) e o **Último Número Emitido** (ex.: se for série nova, informe `0` para que a primeira seja a número `1`).
5. Vá em **API Keys / Integrações**:
   - Gere ou copie a **Project API Key** de Produção (ex.: `ntaas_prod_xxxxxxxxxxxxxxxxxxxxxxxx`).

---

### Etapa 2: Atualização das Variáveis de Ambiente no Backend

1. Conecte-se ao servidor onde o backend do sistema está hospedado.
2. Localize e edite o arquivo `.env` do backend:

```env
# ==========================================
# NOTAAS API - AMBIENTE DE PRODUÇÃO (OFICIAL)
# ==========================================
NOTAAS_BASE_URL=https://platform.notaas.com.br
NOTAAS_API_KEY=ntaas_prod_xxxxxxxxxxxxxxxxxxxxxxxx
```

> **Atenção:** Certifique-se de substituir o valor antigo de testes pela chave de produção copiada na Etapa 1.

3. Reinicie a aplicação backend para aplicar a nova variável:
   - Se estiver usando **PM2**:
     ```bash
     pm2 restart altomaster-backend --update-env
     ```
   - Se estiver usando **Docker / Docker Compose**:
     ```bash
     docker compose restart backend
     ```
   - Se for serviço nativo/systemd:
     ```bash
     sudo systemctl restart altomaster-backend
     ```

---

### Etapa 3: Teste Piloto e Validação da 1ª Nota em Produção

Execute este teste em conjunto com a equipe fiscal/contábil:

1. **Seleção do Contrato:**
   - Escolha um contrato de locação real que esteja em fase de triagem/saída.
   - Verifique previamente no cadastro do cliente:
     - **CNPJ:** Válido e ativo na Receita Federal.
     - **Inscrição Estadual:** Se o cliente for contribuinte, verifique se a IE está ativa no Sintegra/CCC. Se for não-contribuinte, deixe o campo de IE em branco ou marcado como Isento.
     - **Endereço:** CEP válido e município correto.
     - **Equipamentos:** Certifique-se de que o equipamento possui o valor patrimonial preenchido em `equipments.value` e NCM cadastrado (ou padrão `84272090`).

2. **Execução da Triagem:**
   - No frontend novo (`frontend_reboot`), acesse **Logística > Triagem** da locação.
   - Preencha o horímetro de saída, selecione a máquina e clique em **Concluir Triagem**.
   - O modal de staging abrirá executando as etapas:
     - Alocação dos equipamentos.
     - Montagem do payload de NF-e.
     - Envio e autorização na SEFAZ.
     - Geração do DANFE Clássico com Canhoto em PDF.

3. **Conferência Obrigatória do DANFE:**
   - Abra o botão **"Abrir DANFE de Remessa (PDF)"**.
   - Verifique os seguintes pontos no documento:
     - [ ] **Sem Tarja de Homologação:** O documento **NÃO** pode ter a marca d'água *"SEM VALOR FISCAL - HOMOLOGAÇÃO"*.
     - [ ] **Protocolo SEFAZ:** Exibe protocolo oficial de autorização com código `100 - Autorizado o uso da NF-e`.
     - [ ] **Canhoto:** Canhoto destacável de recebimento preenchido corretamente no topo.
     - [ ] **Natureza da Operação:** `REMESSA DE BEM DO ATIVO IMOBILIZADO`.
     - [ ] **CFOP:** `5554` (dentro de MT) ou `6554` (fora de MT).
     - [ ] **Tributos:** Todos zerados (Base ICMS 0,00, ICMS 0,00, Total da Nota igual à soma dos bens).
     - [ ] **Consulta SEFAZ:** Copie a chave de acesso de 44 dígitos e consulte no portal oficial da SEFAZ:  
       [https://www.nfe.fazenda.gov.br/portal/consultaRecorte.aspx](https://www.nfe.fazenda.gov.br/portal/consultaRecorte.aspx)  
       A nota deve constar como **Autorizada**.

---

### Etapa 4: Procedimento de Cancelamento (Caso o Piloto seja Apenas de Teste)

Caso a primeira emissão em produção tenha sido realizada com dados fictícios ou para fins estritamente de homologação em ambiente real:

> **Atenção:** Na SEFAZ-MT, o prazo legal para cancelamento de NF-e de saída é de até **24 horas**, desde que o equipamento ainda não tenha iniciado o transporte.

Para cancelar uma nota de teste emitida em produção:
1. Acesse o painel da Notaas (`platform.notaas.com.br`) ou utilize o endpoint de cancelamento.
2. Informe a Chave de Acesso ou `invoiceId` e a justificativa (mínimo 15 caracteres, ex.: *"Cancelamento por erro de teste operacional na emissão de remessa"*).
3. Verifique se o status mudou para **Cancelada** na SEFAZ.

---

## 4. Guia de Diagnóstico e Resolução de Erros Comuns da SEFAZ

| Código / Erro SEFAZ | Causa Comum | Ação Corretiva |
| :--- | :--- | :--- |
| **Rejeição 204:** *Duplicidade de NF-e* | O número da nota já foi utilizado anteriormente na mesma série. | Altere o "Último Número Emitido" no Notaas para um número superior ao já utilizado, ou mude a Série da NF-e. |
| **Rejeição 232:** *IE do destinatário não informada* | Cliente possui Inscrição Estadual ativa no Sintegra, mas foi enviado com `indicadorIEDest: 9` (Não Contribuinte). | No cadastro do cliente, preencha o número correto da Inscrição Estadual. |
| **Rejeição 234:** *IE do destinatário não vinculada ao CNPJ* | A Inscrição Estadual informada não pertence ao CNPJ do cliente. | Consultar o CNPJ no Cadastro Centralizado de Contribuintes (CCC/Sintegra) e corrigir o número da IE. |
| **Rejeição 256:** *Uma NF-e de entrada não pode ser emitida por...* | Ocorreu tentativa de emitir NF-e de retorno para um cliente que possui IE ativa. | Clientes com IE ativa devem emitir sua própria nota de devolução e apenas anexar o XML/DANFE no sistema. |
| **Rejeição 297:** *Assinatura difere do calculado* | Certificado Digital A1 expirado, revogado ou corrompido no Notaas. | Fazer novo upload do arquivo `.pfx` com a senha no painel Notaas. |
| **Rejeição 539:** *Duplicidade de NF-e com diferença na Chave de Acesso* | Tentativa de reemitir a mesma nota com dados diferentes sob a mesma numeração. | Inutilizar a numeração na SEFAZ ou avançar a numeração no Notaas. |

---

## 5. Matriz de Responsabilidades (RACI)

| Atividade | Responsável Técnico | Contabilidade / Fiscal | Logística / Operações |
| :--- | :---: | :---: | :---: |
| Definição da Série e Numeração Oficial | Consultado | **Responsável** | Informado |
| Upload do Certificado A1 no Notaas | **Responsável** | Consultado | Informado |
| Atualização da `NOTAAS_API_KEY` no `.env` | **Responsável** | Informado | Informado |
| Validação e Aprovação do DANFE Piloto | Consultado | **Responsável** | Consultado |
| Treinamento e Operação Contínua da Triagem | Informado | Consultado | **Responsável** |
| Monitoramento de Notas Autorizadas e XMLs | **Responsável** | **Responsável** | Consultado |

---

## 6. Conclusão e Liberação Operacional (Go-Live Aprovado)

Após a realização do teste piloto e validação contábil:
1. Comunique a equipe de Logística que todas as saídas de equipamentos devem ser formalizadas via Triagem no sistema.
2. O DANFE gerado deve ser impresso em 2 vias (ou disponibilizado em PDF para o motorista) e acompanhar o transporte da máquina até a obra do cliente.
3. A via com o canhoto assinado pelo cliente no ato da entrega deve ser arquivada ou digitalizada junto ao contrato.

---
*RentDesk — C3Loc / Altomaster — Tecnologia a Serviço da Produtividade em Locação de Plataformas.*

