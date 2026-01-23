import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectRepository } from '@nestjs/typeorm';
import { File } from './entities/file.entity';
import { Repository } from 'typeorm';

@Injectable()
export class FilesService {
  private logger = new Logger('FileService');
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor(
    @InjectRepository(File)
    private fileRepository: Repository<File>,
  ) {
    this.client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
      },
    });
    this.bucketName = process.env.AWS_S3_NAME;
  }

  async uploadFile(file: Express.Multer.File) {
    const partsName = file.originalname.split('.');
    const extension = partsName.pop();

    const { buffer, mimetype } = file;
    const uuid = uuidv4();

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: uuid,
      Body: buffer,
      ContentType: mimetype,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException({
        message: 'Ocurrio un error al subir el archivo',
      });
    }

    await this.fileRepository.save({
      id: uuid,
      name: partsName.join('.'),
      extension: extension,
    });

    const url = await this.findOne(uuid)

    return { id: uuid, ...url };
  }

  async findOne(id: string) {
    const file = await this.fileRepository.findOneBy({ id });
    if (!file)
      throw new NotFoundException({ message: 'Archivo no encontrado' });

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: file.id,
      ResponseContentDisposition: `attachment; filename="${file.name}.${file.extension}"`,
    });

    const signedUrl = await getSignedUrl(this.client, command, {
      expiresIn: 3600,
    });

    return { ...file, url: signedUrl };
  }

  async remove(id: string) {
    const file = await this.fileRepository.findOneBy({ id });
    if (!file)
      throw new NotFoundException({ message: 'Archivo no encontrado' });

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: file.id,
    });

    try {
      await this.client.send(command);
      await this.fileRepository.delete({ id });
    } catch (error) {
      this.logger.error(error);
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al eliminar el archivo',
      });
    }
  }
}
