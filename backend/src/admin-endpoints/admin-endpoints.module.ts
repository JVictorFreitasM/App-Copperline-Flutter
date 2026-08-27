import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AdminEndpointsController } from './admin-endpoints.controller';
import { SwaggerImportService } from './swagger-import.service';

@Module({
  imports: [HttpModule],
  controllers: [AdminEndpointsController],
  providers: [SwaggerImportService],
})
export class AdminEndpointsModule {}
