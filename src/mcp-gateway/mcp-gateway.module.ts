import { Module } from '@nestjs/common';
import { McpGatewayController } from './mcp-gateway.controller';
import { McpGatewayService } from './mcp-gateway.service';

@Module({
  controllers: [McpGatewayController],
  providers: [McpGatewayService],
  exports: [McpGatewayService],
})
export class McpGatewayModule {}