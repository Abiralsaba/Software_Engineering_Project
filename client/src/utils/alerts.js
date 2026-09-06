import Swal from 'sweetalert2';

const common = {
  background: '#0f172a',
  color: '#fff'
};

export const alerts = {
  loading(title = 'Please wait…') {
    return Swal.fire({
      ...common,
      title,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
  },
  close() {
    Swal.close();
  },
  success(title, text) {
    return Swal.fire({
      ...common,
      icon: 'success',
      title,
      text,
      confirmButtonColor: '#006a4e'
    });
  },
  error(text, title = 'Oops…') {
    return Swal.fire({
      ...common,
      icon: 'error',
      title,
      text,
      confirmButtonColor: '#f42a41'
    });
  }
};
