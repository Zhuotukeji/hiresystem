import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CreateCompanyDto, UpdateCompanyDto } from "./companies.dto";
import { CompaniesService } from "./companies.service";

@Controller("target-companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findMany(@Query() query: Record<string, string>) {
    return this.companiesService.findMany(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }
}
