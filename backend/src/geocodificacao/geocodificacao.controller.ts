import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import {
  GeocodificacaoService,
  type GeocodificacaoDto,
} from './geocodificacao.service';

export class GeocodificacaoQueryDto {
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  q!: string;
}

// Protegido por requireAuth via MiddlewareConsumer (ver geocodificacao.module.ts).
@Controller('geocodificacao')
export class GeocodificacaoController {
  constructor(private readonly geocodificacaoService: GeocodificacaoService) {}

  @Get()
  @UseGuards(RateLimitGuard)
  @RateLimit({ prefixo: 'geocodificacao', limite: 20, janelaSegundos: 60 })
  localizar(@Query() query: GeocodificacaoQueryDto): Promise<GeocodificacaoDto> {
    return this.geocodificacaoService.localizar(query.q);
  }
}
