import { Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { requireRole, type IdpAuth } from '@copperline/idp-client';
import { RequireSessionMiddleware } from '../common/middleware/require-session.middleware';
import { IDP_AUTH } from '../idp-auth/idp-auth.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AdminDocumentosController } from './admin-documentos.controller';
import { DocumentoStorageService } from './documento-storage.service';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';

@Module({
  imports: [PrismaModule, UsuariosModule],
  controllers: [DocumentosController, AdminDocumentosController],
  providers: [DocumentosService, DocumentoStorageService],
})
export class DocumentosModule implements NestModule {
  constructor(@Inject(IDP_AUTH) private readonly idpAuth: IdpAuth) {}

  configure(consumer: MiddlewareConsumer): void {
    // Leitura (listar/baixar) - qualquer vendedor autenticado.
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth)
      .forRoutes(DocumentosController);

    // Upload - autenticado E com role admin (padrao 2 do README de
    // examples/authorization-example: altera estado, restrito a admin).
    consumer
      .apply(RequireSessionMiddleware, this.idpAuth.requireAuth, requireRole('admin'))
      .forRoutes(AdminDocumentosController);
  }
}
