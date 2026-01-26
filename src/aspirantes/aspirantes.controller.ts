import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AspirantesService } from './aspirantes.service';
import { CreateAspiranteDto } from './dto/create-aspirante.dto';
import { UpdateAspiranteDto } from './dto/update-aspirante.dto';
import { SaveAssessmentDto } from './dto/save-assessment.dto';

@Controller('aspirantes')
export class AspirantesController {
  constructor(private readonly aspirantesService: AspirantesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('evidence'))
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: false, // Permitir campos adicionales cuando hay FormData
    transform: true,
    skipMissingProperties: false,
  }))
  create(
    @Body() body: any,
    @UploadedFile() evidence?: Express.Multer.File,
  ) {
    console.log('=== CONTROLADOR ASPIRANTES ===');
    console.log('Body keys:', Object.keys(body));
    console.log('Body completo:', JSON.stringify(body, null, 2));
    console.log('Evidence recibida:', evidence ? { 
      name: evidence.originalname, 
      size: evidence.size,
      mimetype: evidence.mimetype,
      fieldname: evidence.fieldname,
      encoding: evidence.encoding,
      buffer: evidence.buffer ? `Buffer de ${evidence.buffer.length} bytes` : 'No buffer',
      destination: evidence.destination,
      filename: evidence.filename,
      path: evidence.path,
    } : 'NO HAY EVIDENCIA');
    console.log('PaymentMethodId:', body.paymentMethodId);
    console.log('Body.evidence:', body.evidence);
    console.log('Tipo de body.evidence:', typeof body.evidence);
    console.log('==============================');
    
    // Si viene FormData, parsear los campos JSON stringificados
    const createAspiranteDto: CreateAspiranteDto = {
      firstName: body.firstName,
      lastNamePaternal: body.lastNamePaternal,
      lastNameMaternal: body.lastNameMaternal || undefined,
      phone: body.phone,
      email: body.email,
      age: body.age 
        ? (typeof body.age === 'string' 
          ? (body.age.trim() ? Number(body.age.trim()) : undefined) 
          : (typeof body.age === 'number' ? body.age : undefined))
        : undefined,
      language: body.language,
      occupation: body.occupation,
      gender: body.gender,
      paymentMethodId: typeof body.paymentMethodId === 'string' ? Number(body.paymentMethodId) : body.paymentMethodId,
      statusId: body.statusId || undefined,
      valoracionEventId: body.valoracionEventId || undefined,
    };
    
    // Parsear medicalHistory si viene como string
    if (body.medicalHistory) {
      try {
        const parsed = typeof body.medicalHistory === 'string' 
          ? JSON.parse(body.medicalHistory) 
          : body.medicalHistory;
        createAspiranteDto.medicalHistory = parsed;
      } catch (e) {
        // Si falla el parse, mantener como está si ya es objeto
        if (typeof body.medicalHistory === 'object') {
          createAspiranteDto.medicalHistory = body.medicalHistory;
        }
      }
    }
    
    return this.aspirantesService.create(createAspiranteDto, evidence);
  }

  @Get()
  findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC',
    @Query('search') search?: string,
    @Query('statusId') statusId?: string,
  ) {
    return this.aspirantesService.findAll(
      limit ? parseInt(limit, 10) : 10,
      offset ? parseInt(offset, 10) : 0,
      sort || 'createdAt',
      order || 'DESC',
      search || '',
      statusId,
    );
  }

  @Get('stats')
  getStats() {
    return this.aspirantesService.getStats();
  }

  @Get('check-email/:email')
  async checkEmail(@Param('email') email: string) {
    return this.aspirantesService.checkEmailExists(email);
  }

  @Get('check-phone/:phone')
  async checkPhone(@Param('phone') phone: string) {
    return this.aspirantesService.checkPhoneExists(phone);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aspirantesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAspiranteDto: UpdateAspiranteDto,
  ) {
    return this.aspirantesService.update(id, updateAspiranteDto);
  }

  @Post(':id/save-assessment')
  @UsePipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }))
  saveAssessment(
    @Param('id') id: string,
    @Body() saveAssessmentDto: SaveAssessmentDto,
  ) {
    return this.aspirantesService.saveAssessment(id, saveAssessmentDto);
  }

  @Post(':id/promote-to-user')
  promoteToUser(@Param('id') id: string) {
    return this.aspirantesService.promoteToUser(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aspirantesService.remove(id);
  }
}
