import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaginatePaymentDto } from './dto/paginate-payment.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { User } from 'src/users/entities/user.entity';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.createManualPayment(createPaymentDto);
  }

  @Get()
  findAll(@Query() paginationDto: PaginatePaymentDto) {
    return this.paymentsService.findAll(paginationDto);
  }

  @Get('my-payments')
  @Auth()
  getMyPayments(@GetUser() user: User) {
    return this.paymentsService.findByUserId(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentsService.update(id, updatePaymentDto);
  }

  @Get('aspirant/:aspirantId/latest')
  getLatestPaymentByAspirant(@Param('aspirantId') aspirantId: string) {
    return this.paymentsService.getLatestPaymentByAspirantId(aspirantId);
  }

  @Patch('aspirant/:aspirantId/status')
  updateAspirantPaymentStatus(
    @Param('aspirantId') aspirantId: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentsService.updateAspirantPaymentStatus(aspirantId, updatePaymentDto);
  }

  @Post(':id/evidence')
  @UseInterceptors(FileInterceptor('file'))
  uploadEvidence(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.paymentsService.uploadEvidence(id, file);
  }
}
