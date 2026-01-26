import { Injectable } from '@nestjs/common';
import { CreateAspirantPhysicalRecordDto } from './dto/create-aspirant-physical-record.dto';
import { UpdateAspirantPhysicalRecordDto } from './dto/update-aspirant-physical-record.dto';

@Injectable()
export class AspirantPhysicalRecordService {
  create(createAspirantPhysicalRecordDto: CreateAspirantPhysicalRecordDto) {
    return 'This action adds a new aspirantPhysicalRecord';
  }

  findAll() {
    return `This action returns all aspirantPhysicalRecord`;
  }

  findOne(id: number) {
    return `This action returns a #${id} aspirantPhysicalRecord`;
  }

  update(id: number, updateAspirantPhysicalRecordDto: UpdateAspirantPhysicalRecordDto) {
    return `This action updates a #${id} aspirantPhysicalRecord`;
  }

  remove(id: number) {
    return `This action removes a #${id} aspirantPhysicalRecord`;
  }
}
