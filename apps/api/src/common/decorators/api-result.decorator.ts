import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { ResponseDto } from '../dto/response.dto';

export const ApiResultResponse = <TModel extends Type<any>>(model?: TModel, isArray = false) => {
  const dataProperty = model
    ? isArray
      ? { type: 'array', items: { $ref: getSchemaPath(model) } }
      : { $ref: getSchemaPath(model) }
    : { type: 'object', additionalProperties: true }; // 默认任意对象，如果没有指定模式

  const extraModels: Type<any>[] = [ResponseDto as Type<any>];
  if (model) {
    extraModels.push(model);
  }

  return applyDecorators(
    ApiExtraModels(...extraModels),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResponseDto) },
          {
            properties: {
              data: dataProperty,
            },
          },
        ],
      },
    }),
  );
};
