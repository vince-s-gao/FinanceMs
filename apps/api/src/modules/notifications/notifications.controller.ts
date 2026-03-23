import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators";
import { JwtAuthGuard } from "../../common/guards";
import { QueryNotificationDto } from "./dto/query-notification.dto";
import { NotificationsService } from "./notifications.service";
import type { AuthenticatedUser } from "../../common/types/auth-user.type";

@ApiTags("消息通知")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "获取我的通知列表" })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationsService.findMine(user.id, query);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "获取我的未读通知数" })
  getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Post(":id/read")
  @ApiOperation({ summary: "将单条通知标记为已读" })
  markAsRead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Post("read-all")
  @ApiOperation({ summary: "将所有通知标记为已读" })
  markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }
}
