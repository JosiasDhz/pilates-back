import { Test, TestingModule } from '@nestjs/testing';
import { PaymentAdminService } from './payment-admin.service';

describe('PaymentAdminService', () => {
  let service: PaymentAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentAdminService],
    }).compile();

    service = module.get<PaymentAdminService>(PaymentAdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
