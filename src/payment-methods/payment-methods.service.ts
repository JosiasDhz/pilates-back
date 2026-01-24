import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaginatePaymentMethodDto } from './dto/paginate-payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
  ) {}

  /**
   * Remueve acentos y diacríticos de un string
   */
  private removeAccents(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Normaliza el nombre: trim, normaliza espacios múltiples, remueve acentos y capitaliza
   */
  private normalizeName(name: string): string {
    if (!name) return '';
    return name
      .trim()
      .replace(/\s+/g, ' ') // Reemplaza múltiples espacios por uno solo
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Normaliza el nombre para comparación: remueve acentos, convierte a minúsculas y normaliza espacios
   */
  private normalizeNameForComparison(name: string): string {
    if (!name) return '';
    return this.removeAccents(name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' '); // Normaliza espacios múltiples
  }

  /**
   * Verifica si existe un método con el mismo nombre (case-insensitive, sin acentos y normalizado)
   */
  private async checkNameExists(
    name: string,
    excludeId?: number,
  ): Promise<PaymentMethod | null> {
    const normalizedNameForComparison = this.normalizeNameForComparison(name);
    
    // Obtener todos los métodos para comparar (normalmente serán pocos)
    // Alternativamente podríamos usar una función de base de datos, pero esto es más compatible
    const allMethods = await this.paymentMethodRepository.find();

    // Comparar cada método normalizado con el nombre proporcionado
    for (const method of allMethods) {
      // Si es el mismo registro que estamos actualizando, saltarlo
      if (excludeId && method.id === excludeId) {
        continue;
      }

      // Normalizar el nombre del método existente para comparación
      const existingNameNormalized = this.normalizeNameForComparison(method.name);

      // Comparar nombres normalizados (sin acentos, case-insensitive)
      if (existingNameNormalized === normalizedNameForComparison) {
        return method;
      }
    }

    return null;
  }

  async create(createPaymentMethodDto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    // Normalizar el nombre
    const normalizedName = this.normalizeName(createPaymentMethodDto.name);
    
    if (!normalizedName || normalizedName.length === 0) {
      throw new BadRequestException('El nombre del método de pago no puede estar vacío');
    }

    // Verificar si ya existe un método con el mismo nombre (case-insensitive)
    const existing = await this.checkNameExists(normalizedName);

    if (existing) {
      throw new BadRequestException(
        `Ya existe un método de pago con el nombre: "${existing.name}"`,
      );
    }

    // Normalizar instrucciones si existen
    const normalizedInstructions = createPaymentMethodDto.instructions
      ? createPaymentMethodDto.instructions.trim()
      : null;

    const paymentMethod = this.paymentMethodRepository.create({
      ...createPaymentMethodDto,
      name: normalizedName,
      instructions: normalizedInstructions || undefined,
      status: createPaymentMethodDto.status !== undefined ? createPaymentMethodDto.status : true,
    });

    return await this.paymentMethodRepository.save(paymentMethod);
  }

  async findAll(paginationDto?: PaginatePaymentMethodDto) {
    const {
      limit = 10,
      offset = 0,
      sort = 'createdAt',
      order = 'asc',
      search = '',
    } = paginationDto || {};

    const query = this.paymentMethodRepository
      .createQueryBuilder('paymentMethod')
      .take(limit)
      .skip(offset);

    if (search.trim() !== '') {
      query.andWhere(
        '(paymentMethod.name ILIKE :search OR paymentMethod.instructions ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    // Mapeo de campos de ordenamiento
    const sortMapping: Record<string, string> = {
      nombre: 'paymentMethod.name',
      name: 'paymentMethod.name',
      tipo: 'paymentMethod.type',
      type: 'paymentMethod.type',
      creado: 'paymentMethod.createdAt',
      createdAt: 'paymentMethod.createdAt',
    };

    const sortField = sortMapping[sort] || 'paymentMethod.createdAt';
    const orderType = order === 'asc' ? 'ASC' : 'DESC';
    query.orderBy(sortField, orderType);

    const [records, total] = await query.getManyAndCount();

    return {
      records,
      total,
    };
  }

  async findOne(id: number): Promise<PaymentMethod> {
    const paymentMethod = await this.paymentMethodRepository.findOne({
      where: { id },
    });

    if (!paymentMethod) {
      throw new NotFoundException(`Método de pago con ID ${id} no encontrado`);
    }

    return paymentMethod;
  }

  async update(
    id: number,
    updatePaymentMethodDto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    const paymentMethod = await this.findOne(id);

    // Si se está actualizando el nombre, normalizar y verificar duplicados
    if (updatePaymentMethodDto.name) {
      const normalizedName = this.normalizeName(updatePaymentMethodDto.name);
      
      if (!normalizedName || normalizedName.length === 0) {
        throw new BadRequestException('El nombre del método de pago no puede estar vacío');
      }

      // Verificar que no exista otro con el mismo nombre (excluyendo el actual)
      const existing = await this.checkNameExists(normalizedName, id);

      if (existing) {
        throw new BadRequestException(
          `Ya existe un método de pago con el nombre: "${existing.name}"`,
        );
      }

      updatePaymentMethodDto.name = normalizedName;
    }

    // Normalizar instrucciones si se están actualizando
    if (updatePaymentMethodDto.instructions !== undefined) {
      updatePaymentMethodDto.instructions = updatePaymentMethodDto.instructions
        ? updatePaymentMethodDto.instructions.trim() || undefined
        : undefined;
    }

    Object.assign(paymentMethod, updatePaymentMethodDto);
    return await this.paymentMethodRepository.save(paymentMethod);
  }

  async remove(id: number): Promise<void> {
    const paymentMethod = await this.findOne(id);
    await this.paymentMethodRepository.remove(paymentMethod);
  }
}
