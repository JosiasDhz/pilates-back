import { Injectable } from '@nestjs/common';
import { CreateAspiranteDto } from './dto/create-aspirante.dto';
import { UpdateAspiranteDto } from './dto/update-aspirante.dto';

@Injectable()
export class AspirantesService {
  create(createAspiranteDto: CreateAspiranteDto) {
    return 'This action adds a new aspirante';
  }

  findAll() {
    return `This action returns all aspirantes`;
  }

  findOne(id: number) {
    return `This action returns a #${id} aspirante`;
  }

  update(id: number, updateAspiranteDto: UpdateAspiranteDto) {
    return `This action updates a #${id} aspirante`;
  }

  remove(id: number) {
    return `This action removes a #${id} aspirante`;
  }
}
