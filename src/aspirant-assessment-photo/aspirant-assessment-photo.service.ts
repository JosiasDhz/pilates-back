import { Injectable } from '@nestjs/common';
import { CreateAspirantAssessmentPhotoDto } from './dto/create-aspirant-assessment-photo.dto';
import { UpdateAspirantAssessmentPhotoDto } from './dto/update-aspirant-assessment-photo.dto';

@Injectable()
export class AspirantAssessmentPhotoService {
  create(createAspirantAssessmentPhotoDto: CreateAspirantAssessmentPhotoDto) {
    return 'This action adds a new aspirantAssessmentPhoto';
  }

  findAll() {
    return `This action returns all aspirantAssessmentPhoto`;
  }

  findOne(id: number) {
    return `This action returns a #${id} aspirantAssessmentPhoto`;
  }

  update(id: number, updateAspirantAssessmentPhotoDto: UpdateAspirantAssessmentPhotoDto) {
    return `This action updates a #${id} aspirantAssessmentPhoto`;
  }

  remove(id: number) {
    return `This action removes a #${id} aspirantAssessmentPhoto`;
  }
}
