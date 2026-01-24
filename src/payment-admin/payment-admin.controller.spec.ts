import { Test, TestingModule } from '@nestjs/testing';
import { PaymentAdminController } from './payment-admin.controller';
import { PaymentAdminService } from './payment-admin.service';

describe('PaymentAdminController', () => {
  let controller: PaymentAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentAdminController],
      providers: [PaymentAdminService],
    }).compile();

    controller = module.get<PaymentAdminController>(PaymentAdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
