import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { Employee } from './entities/employee.entity';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  async findOne(id: string): Promise<Employee> {
    if (!isUUID(id))
      throw new NotFoundException('Proporciona un UUID válido de empleado');
    const emp = await this.employeeRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!emp) throw new NotFoundException(`Empleado con id ${id} no encontrado`);
    return emp;
  }

  async findByUserId(userId: string): Promise<Employee | null> {
    return this.employeeRepository.findOne({
      where: { userId },
      relations: { user: true },
    });
  }

  /**
   * Marca al empleado como inactivo y registra resignedAt.
   */
  async deactivate(employeeId: string): Promise<{ message: string }> {
    const emp = await this.findOne(employeeId);
    if (!emp.isActive)
      throw new ConflictException('El empleado ya está inactivo');
    const now = new Date();
    await this.employeeRepository.update(emp.id, {
      isActive: false,
      resignedAt: now,
    });
    return { message: 'Empleado desactivado correctamente' };
  }

  /**
   * Reactiva al empleado: isActive true, latestContractAt ahora, resignedAt null.
   * hiredAt se mantiene intacto.
   */
  async reactivate(employeeId: string): Promise<{ message: string }> {
    const emp = await this.findOne(employeeId);
    if (emp.isActive)
      throw new ConflictException('El empleado ya está activo');
    const now = new Date();
    await this.employeeRepository.update(emp.id, {
      isActive: true,
      latestContractAt: now,
      resignedAt: null,
    });
    return { message: 'Empleado reactivado correctamente' };
  }
}
