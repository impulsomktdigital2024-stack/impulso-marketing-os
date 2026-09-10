# ChamaJá Android

Aplicativo Android do ChamaJá, package `com.chamaja.app`.

## Arquitetura

Esta versão Android utiliza um shell nativo seguro sobre a aplicação online do ChamaJá. O backend, autenticação, dados, chat, matching e regras financeiras continuam centralizados no projeto Supabase separado do ChamaJá, evitando regras divergentes entre web e Android.

## Recursos do shell Android

- HTTPS obrigatório e cleartext bloqueado
- erro SSL não é ignorado
- JavaScript e DOM Storage para a aplicação React
- sessão/cookies persistentes
- geolocalização com permissão nativa
- seletor de fotos/arquivos para pedidos
- navegação para Stripe Checkout e Stripe Connect
- suporte a esquemas externos quando o Android possui um app compatível
- botão Voltar respeita o histórico do WebView
- targetSdk/compileSdk 36 (Android 16)

## Build

O workflow `Build ChamaJá APK` compila e executa lint com JDK 17, Android SDK 36, Android Gradle Plugin 9.4.0 e Gradle 9.6.0. O artefato entregue é o `app-debug.apk`, assinado automaticamente com chave de debug e adequado para instalação/testes fora da Play Store.

Para publicação na Google Play, criar uma chave de release própria e usar Play App Signing. Nunca versionar chaves privadas neste repositório.
