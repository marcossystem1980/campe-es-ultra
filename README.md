# Copa dos Colaboradores 2026

Primeira versão funcional criada com HTML, CSS e JavaScript puro, sem servidor ou dependências obrigatórias.

## Como abrir no VS Code

1. Extraia os arquivos desta pasta para a pasta do projeto que você criou no VS Code (`MeuNovoSite`).
2. Abra `index.html` no navegador. Você também pode instalar a extensão Live Server no VS Code, se tiver permissão, e escolher **Open with Live Server**.
3. Abra **Participantes**, cole nomes um por linha ou importe um CSV/TXT e clique em **Salvar lista**.
4. Na mesma página, logo abaixo do formulário, aparece **Avaliação do nível dos jogadores**. Atribua a cada pessoa um nível de 1 a 5: Iniciante, Básico, Intermediário, Avançado ou Destaque. O sorteio não libera enquanto houver avaliações em branco.
5. Em **Times**, escolha a quantidade de equipes e quantos jogadores começam em campo. Clique em **Sortear equipes**.
6. Em **Times**, personalize nomes, cores e símbolos dos escudos. Cada equipe mostra a média de nível do elenco e dos titulares.
7. Em **Chaveamento**, clique em **Gerar chaveamento** e registre os placares. Empates precisam de um vencedor nos pênaltis.
8. Em **Configurações**, informe o nome do campeonato, o nome da empresa e selecione o logo. Clique em **Salvar identidade** para aplicar nome e empresa em todas as telas. O logo selecionado é aplicado ao menu lateral, cabeçalho global, painel inicial, prévia e versão de impressão. Exporte backups regularmente.

## O que já funciona

- Layout responsivo para computador, celular e visualização em tela grande.
- Importação de participantes por texto, CSV ou TXT; nomes repetidos são ignorados.
- Avaliação manual do nível técnico de cada participante por cinco estrelas clicáveis (1 a 5), com bloqueio do sorteio até todas as avaliações estarem preenchidas.
- Sorteio equilibrado por nível: jogadores de mesmo nível são embaralhados e os níveis são distribuídos em padrão serpentina entre os times, buscando aproximar a força média dos elencos.
- Separação automática entre escalação inicial e reservas vinculados ao time sorteado; a média do elenco e dos titulares aparece em cada cartão de equipe.
- Personalização dos nomes, cores e emblemas das equipes.
- Chaveamento eliminatório com passagens automáticas de fase, placares e desempate por pênaltis.
- Campeão exibido no painel e na tela do chaveamento.
- Identidade sincronizada: nome do campeonato, nome da empresa e logo são exibidos nas telas do aplicativo, no menu lateral, no cabeçalho global, no painel inicial e na impressão do chaveamento. O formulário de configuração mantém rascunhos sem apagá-los ao carregar ou remover o logo.
- Logo da empresa, salvamento local e backup/importação em JSON.
- Impressão da tela de chaveamento.

## Observações importantes

- Os dados ficam no armazenamento local do navegador e neste computador/perfil de navegador. Eles não são sincronizados automaticamente entre outros computadores ou celulares.
- Exporte um backup JSON antes de limpar o histórico do navegador ou trocar de computador.
- A estrutura da primeira versão considera eliminatórias (mata-mata). Para equipes em número que não seja potência de 2, o sistema atribui passagens automáticas para completar a chave.
- A escalação inicial é determinada pela quantidade “Jogadores em campo por time”; as demais pessoas do time são listadas como reservas.
- O layout usa fontes do Google Fonts quando houver internet; sem conexão, utiliza fontes locais alternativas.
- Os arquivos `assets/img/logo-empresa.png` e `assets/img/estadio-background.jpg` são usados no projeto. O fundo de estádio incluído foi criado especialmente para esta interface; o wallpaper AlphaCoders enviado como referência (https://wall.alphacoders.com/big.php?i=1332396) é marcado na página original como uso pessoal/privado, com orientação para contatar o artista para outros usos.
- Alterar a avaliação de um participante após o sorteio pede confirmação e remove times/placares, para que a regra de equilíbrio seja respeitada no próximo sorteio.
