import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { SalesService } from './sales.service';

class PublicWebsiteLeadDto {
  @IsString()
  @Length(2, 100)
  name!: string;

  @IsString()
  @Length(8, 20)
  phone!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  interest?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

@Controller('public/website')
@UseGuards(ThrottlerGuard)
export class PublicWebsiteController {
  constructor(private readonly salesService: SalesService) {}

  @Post('leads')
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  async createLead(@Body() body: PublicWebsiteLeadDto) {
    // Honeypot submissions get a neutral response so bots cannot tune around it.
    if (body.website?.trim()) return { accepted: true };
    const lead = await this.salesService.createPublicWebsiteLead(body);
    return { accepted: true, id: lead.id };
  }
}
