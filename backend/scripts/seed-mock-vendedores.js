// Script avulso (nao roda em produção, nao faz parte do build) - cria uma
// hierarquia de vendedores MOCADOS pra exercitar OS-BACKEND-22/OS-WEB-21
// (hierarquia, GET/PATCH /admin/vendedores, GET /vendedores/equipe) sem
// depender de sincronizar de verdade com o WK Radar. Todos os registros
// têm id_externo_erp prefixado "MOCK-" (nunca colide com os ids numéricos
// reais do WK Radar) e nome prefixado "[MOCK]", pra ficar óbvio na tela
// admin/vendedores que é dado de teste, nao vendedor real.
//
// Uso: docker exec appcopperline-backend-1 node scripts/seed-mock-vendedores.js

const { PrismaClient } = require('../dist/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const AGORA = new Date();

async function upsertVendedor({ idExternoErp, codigo, nome, email, papel }) {
  return prisma.vendedor.upsert({
    where: { idExternoErp },
    update: { codigo, nome, email, papel, sincronizadoEm: AGORA },
    create: {
      idExternoErp,
      codigo,
      nome,
      email,
      papel,
      inativo: false,
      incompleto: false,
      semCorrespondenciaUsuario: true,
      sincronizadoEm: AGORA,
    },
  });
}

async function main() {
  const gerente = await upsertVendedor({
    idExternoErp: 'MOCK-0001',
    codigo: 'M001',
    nome: '[MOCK] Marina Torres - Gerência Comercial',
    email: 'marina.torres.mock@copperline.com.br',
    papel: 'GERENTE',
  });

  const supervisorNorte = await upsertVendedor({
    idExternoErp: 'MOCK-0002',
    codigo: 'M002',
    nome: '[MOCK] Carlos Eduardo - Supervisão Norte',
    email: 'carlos.eduardo.mock@copperline.com.br',
    papel: 'SUPERVISOR',
  });

  const supervisorSul = await upsertVendedor({
    idExternoErp: 'MOCK-0003',
    codigo: 'M003',
    nome: '[MOCK] Fernanda Lima - Supervisão Sul',
    email: 'fernanda.lima.mock@copperline.com.br',
    papel: 'SUPERVISOR',
  });

  const vendedorNorte1 = await upsertVendedor({
    idExternoErp: 'MOCK-0004',
    codigo: 'M004',
    nome: '[MOCK] Bruno Alves',
    email: 'bruno.alves.mock@copperline.com.br',
    papel: 'VENDEDOR',
  });

  const vendedorNorte2 = await upsertVendedor({
    idExternoErp: 'MOCK-0005',
    codigo: 'M005',
    nome: '[MOCK] Patrícia Nunes',
    email: 'patricia.nunes.mock@copperline.com.br',
    papel: 'VENDEDOR',
  });

  const vendedorSul1 = await upsertVendedor({
    idExternoErp: 'MOCK-0006',
    codigo: 'M006',
    nome: '[MOCK] Diego Ramos',
    email: 'diego.ramos.mock@copperline.com.br',
    papel: 'VENDEDOR',
  });

  await prisma.vendedor.update({
    where: { id: supervisorNorte.id },
    data: { supervisorId: gerente.id },
  });
  await prisma.vendedor.update({
    where: { id: supervisorSul.id },
    data: { supervisorId: gerente.id },
  });
  await prisma.vendedor.update({
    where: { id: vendedorNorte1.id },
    data: { supervisorId: supervisorNorte.id },
  });
  await prisma.vendedor.update({
    where: { id: vendedorNorte2.id },
    data: { supervisorId: supervisorNorte.id },
  });
  await prisma.vendedor.update({
    where: { id: vendedorSul1.id },
    data: { supervisorId: supervisorSul.id },
  });

  console.log('Hierarquia mocada criada:');
  console.log(
    `  ${gerente.nome} (GERENTE)\n` +
      `    -> ${supervisorNorte.nome} (SUPERVISOR)\n` +
      `         -> ${vendedorNorte1.nome} (VENDEDOR)\n` +
      `         -> ${vendedorNorte2.nome} (VENDEDOR)\n` +
      `    -> ${supervisorSul.nome} (SUPERVISOR)\n` +
      `         -> ${vendedorSul1.nome} (VENDEDOR)`,
  );
}

main()
  .catch((erro) => {
    console.error('Falha ao criar vendedores mocados:', erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
