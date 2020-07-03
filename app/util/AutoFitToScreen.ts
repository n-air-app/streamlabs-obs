import { ISourceApi } from 'services/sources';

export default {
  isRequired(source: ISourceApi) : boolean {
    switch(source.type) {
      case 'text_ft2_source':
      case 'text_gdiplus':
      case 'color_source':
      case 'wasapi_input_capture':
      case 'wasapi_output_capture':
        return false
      default:
        return true
    }
  }
}