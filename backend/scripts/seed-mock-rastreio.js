// Script avulso (nao roda em produção) - complementa seed-mock-vendedores.js
// linkando 2 dos vendedores mocados a Usuario "fake" (sub inventado, nunca
// autentica de verdade - so serve pra existir a FK que LocalizacaoUsuario/
// Visita exigem) e populando:
//   - LocalizacaoUsuario: trajeto de HOJE (rastreio contínuo, OS-BACKEND-27)
//   - Visita: check-in/checkout concluído em 2 clientes reais (OS-BACKEND-28)
// pra exercitar rastreio de equipe + roteiro/mapa de visitas sem precisar
// de GPS real nem login de verdade.
//
// Uso: docker exec appcopperline-backend-1 node scripts/seed-mock-rastreio.js

const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// São Luís/MA - mesma região dos vendedores reais já sincronizados ("GERÊNCIA
// MA", "MÉDIO PARNAIBA"), só pra o trajeto fazer sentido geograficamente.
const PONTO_BASE = { lat: -2.5307, lng: -44.3068 };

// direcao em radianos (0 = leste, PI/2 = norte, etc) - cada vendedor
// mocado anda numa direcao DIFERENTE a partir do mesmo bairro, senao os
// pontos ficam muito perto/coincidentes e os pins somem uns atras dos
// outros no mapa (bug encontrado - as duas rotas usavam a MESMA base +
// mesmo deslocamento, caindo nas coordenadas EXATAS uma da outra).
function deslocar(base, indice, direcaoRad) {
  const passo = 0.006;
  return {
    lat: base.lat + indice * passo * Math.sin(direcaoRad),
    lng: base.lng + indice * passo * Math.cos(direcaoRad),
  };
}

async function criarUsuarioMock(sub, nome, email) {
  return prisma.usuario.upsert({
    where: { sub },
    update: { nome, email },
    create: { sub, nome, email },
  });
}

async function criarTrajeto(usuarioId, horaInicio, direcaoRad) {
  // Idempotente - reexecutar o script nao acumula pontos duplicados por
  // cima dos de uma execucao anterior.
  await prisma.localizacaoUsuario.deleteMany({ where: { usuarioId } });

  const loteId = require('node:crypto').randomUUID();
  const hoje = new Date();
  hoje.setHours(horaInicio, 0, 0, 0);

  const pontos = Array.from({ length: 6 }, (_, indice) => {
    const { lat, lng } = deslocar(PONTO_BASE, indice, direcaoRad);
    const capturadoEm = new Date(hoje.getTime() + indice * 20 * 60 * 1000);
    return { usuarioId, latitude: lat, longitude: lng, capturadoEm, loteId };
  });

  await prisma.localizacaoUsuario.createMany({ data: pontos });
  return pontos[pontos.length - 1];
}

async function main() {
  const bruno = await prisma.vendedor.findUnique({
    where: { idExternoErp: 'MOCK-0004' },
  });
  const patricia = await prisma.vendedor.findUnique({
    where: { idExternoErp: 'MOCK-0005' },
  });
  if (!bruno || !patricia) {
    throw new Error(
      'Vendedores mocados nao encontrados - rode seed-mock-vendedores.js primeiro.',
    );
  }

  const usuarioBruno = await criarUsuarioMock(
    'mock-sub-bruno-alves',
    '[MOCK] Bruno Alves',
    'bruno.alves.mock@copperline.com.br',
  );
  const usuarioPatricia = await criarUsuarioMock(
    'mock-sub-patricia-nunes',
    '[MOCK] Patrícia Nunes',
    'patricia.nunes.mock@copperline.com.br',
  );

  await prisma.vendedor.update({
    where: { id: bruno.id },
    data: { usuarioId: usuarioBruno.id, semCorrespondenciaUsuario: false },
  });
  await prisma.vendedor.update({
    where: { id: patricia.id },
    data: { usuarioId: usuarioPatricia.id, semCorrespondenciaUsuario: false },
  });

  // Direcoes opostas (nordeste vs sudoeste) a partir do mesmo bairro -
  // garante que as posicoes finais fiquem visivelmente separadas no mapa.
  const ultimoPontoBruno = await criarTrajeto(usuarioBruno.id, 8, Math.PI / 4);
  const ultimoPontoPatricia = await criarTrajeto(usuarioPatricia.id, 9, (5 * Math.PI) / 4);

  const clientes = await prisma.cliente.findMany({
    take: 2,
    select: { id: true, razaoSocial: true },
  });
  if (clientes.length < 2) {
    throw new Error('Menos de 2 clientes na base - nao da pra mocar visita.');
  }

  // Idempotente, mesmo criterio do trajeto acima - reexecutar nao duplica
  // visita.
  await prisma.visita.deleteMany({
    where: { vendedorId: { in: [bruno.id, patricia.id] } },
  });

  const checkinEm = new Date();
  checkinEm.setHours(10, 15, 0, 0);
  const checkoutEm = new Date(checkinEm.getTime() + 35 * 60 * 1000);

  await prisma.visita.create({
    data: {
      clienteId: clientes[0].id,
      vendedorId: bruno.id,
      checkinEm,
      checkinLat: PONTO_BASE.lat,
      checkinLng: PONTO_BASE.lng,
      checkoutEm,
      checkoutLat: PONTO_BASE.lat + 0.001,
      checkoutLng: PONTO_BASE.lng + 0.001,
      nota: '[MOCK] Visita de teste - cliente sem pedido em aberto no momento.',
    },
  });

  const checkinEm2 = new Date();
  checkinEm2.setHours(11, 0, 0, 0);

  await prisma.visita.create({
    data: {
      clienteId: clientes[1].id,
      vendedorId: patricia.id,
      checkinEm: checkinEm2,
      checkinLat: PONTO_BASE.lat + 0.02,
      checkinLng: PONTO_BASE.lng + 0.02,
      nota: '[MOCK] Visita em andamento (sem checkout ainda).',
    },
  });

  console.log('Rastreio + visitas mocados criados:');
  console.log(`  ${bruno.nome}: 6 pontos de trajeto hoje, ultimo em ${ultimoPontoBruno.capturadoEm.toISOString()}`);
  console.log(`  ${patricia.nome}: 6 pontos de trajeto hoje, ultimo em ${ultimoPontoPatricia.capturadoEm.toISOString()}`);
  console.log(`  Visita concluida: ${bruno.nome} -> ${clientes[0].razaoSocial}`);
  console.log(`  Visita em aberto: ${patricia.nome} -> ${clientes[1].razaoSocial}`);
}

main()
  .catch((erro) => {
    console.error('Falha ao criar rastreio/visitas mocados:', erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
